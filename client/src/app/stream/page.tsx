'use client'

import { Copy, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Device, Producer, Transport, RtpCapabilities, TransportOptions, DtlsParameters, RtpParameters, MediaKind } from "mediasoup-client/types";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

interface CreateTransportResponse {
  params: TransportOptions;
}

interface ProduceResponse {
  id: string;
}

interface ConsumeMediaResponse {
  id: string;
  producerId: string;
  kind: MediaKind;
  rtpParameters: RtpParameters;
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  

  const deviceRef = useRef<Device | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const producerTransportRef = useRef<Transport | null>(null);
  const consumerTransportRef = useRef<Transport | null>(null);
  const videoProducerRef = useRef<Producer | null>(null);
  const audioProducerRef = useRef<Producer | null>(null);
 
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

 
  const socketEmitPromise = <T,>(event: string, data?: unknown): Promise<T> => {
    return new Promise((resolve, reject) => {
      const activeSocket = socketRef.current;
      if (!activeSocket) {
        reject(new Error("Socket not connected"));
        return;
      }
      
      const timeout = setTimeout(() => {
        reject(new Error(`Socket emit timeout for event: ${event}`));
      }, 10000);

      const handler = (response: T | { error: string } | { params: { error: string } }) => {
        clearTimeout(timeout);
          resolve(response as T)
      };

      if (data !== undefined) {
        activeSocket.emit(event, data, handler);
      } else {
        activeSocket.emit(event, handler);
      }
    });
  };


  const consumeNewMedia = async () => {
    const usedDevice = deviceRef.current;
    const usedConsumerTransport = consumerTransportRef.current;

    if (!usedDevice || !usedConsumerTransport) {
      return;
    }

    try {
      
      const consumersParams: ConsumeMediaResponse[] = await socketEmitPromise("consumeMedia", {
        rtpCapabilities: usedDevice.rtpCapabilities
      });

      const videoTracks: MediaStreamTrack[] = [];
      const audioTracks: MediaStreamTrack[] = [];

      for (const consumerParams of consumersParams) {
        const consumer = await usedConsumerTransport.consume(consumerParams);

        if (consumer?.track) {
          if (consumer.kind === "video") {
            videoTracks.push(consumer.track);
          } else if (consumer.kind === "audio") {
            audioTracks.push(consumer.track);
          }
        }
      }

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = new MediaStream(videoTracks);
      }

      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = new MediaStream(audioTracks);
      }

      // Resume all consumers
      await socketEmitPromise("consumerResume", {});
      console.log("✅ Consumers resumed");

    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error consuming remote media:", error.message);
      } else {
        console.error("An unexpected error occurred:", error);
      }
    }
  };

  const startLocalMedia = async (): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
       video: {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 30, max: 30 }
},
        audio: true
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }

      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("❌ Error starting media:", error);
      throw error;
    }
  };
  const connectToRoom = async () => {

    try {
      const { io } = await import("socket.io-client");
      const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL}/stream`);
      socketRef.current = newSocket;

      newSocket.on("connection-success", (data: { socketId: string }) => {
        console.log("✅ Connected to server:", data);
      });

      newSocket.on("newProducerAvailable", async () => {
        console.log("🎉 New producer available! (Event received)");
        await consumeNewMedia();
      });

      newSocket.on("peerDisconnected", ({ socketId }: { socketId: string }) => {
        console.log(`👋 Peer disconnected: ${socketId}`);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      });
      
      newSocket.on("connect_error", (error: Error) => {
        console.error("❌ Socket connection error:", error);
      });
      
      await new Promise<void>((resolve, reject) => {
        newSocket.on("connection-success", () => resolve());
        newSocket.on("connect_error", (error) => reject(error));
      });
      
      const stream = await startLocalMedia();

      
      const routerRtpCapabilities: RtpCapabilities = await socketEmitPromise("getRouterRtpCapabilities");

      // Import Device using `await import` and get the type 
      const { Device } = await import("mediasoup-client");
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: routerRtpCapabilities });
      deviceRef.current = newDevice; 

      const { params: producerParams }: CreateTransportResponse = await socketEmitPromise("createTransport", { sender: true });
      const newProducerTransport = newDevice.createSendTransport(producerParams);
      producerTransportRef.current = newProducerTransport;

      newProducerTransport.on("connect", async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback, errback) => {
        try {
          await socketEmitPromise("connectProducerTransport", { dtlsParameters });
          callback();
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error("Error connecting producer transport:", error.message);
          } else {
            console.error("An unexpected error occurred:", error);
          }
          errback(error as Error); 
        }
      });

      newProducerTransport.on("produce", async ({ kind, rtpParameters }: { kind: MediaKind, rtpParameters: RtpParameters }, callback, errback) => {
        try {
          const { id }: ProduceResponse = await socketEmitPromise("transport-produce", { kind, rtpParameters });
          callback({ id });
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error("Error producing media:", error.message);
          } else {
            console.error("An unexpected error occurred:", error);
          }
          errback(error as Error);
        }
      });

      // Step 6: Create consumer transport
      const { params: consumerParams }: CreateTransportResponse = await socketEmitPromise("createTransport", { sender: false });
      const newConsumerTransport = newDevice.createRecvTransport(consumerParams);
      consumerTransportRef.current = newConsumerTransport;
      
      newConsumerTransport.on("connect", async ({ dtlsParameters }: { dtlsParameters: DtlsParameters }, callback, errback) => {
        try {
          await socketEmitPromise("connectConsumerTransport", { dtlsParameters });
          callback();
        } catch (error: unknown) {
          if (error instanceof Error) {
            console.error("Error connecting consumer transport:", error.message);
          } else {
            console.error("An unexpected error occurred:", error);
          }
          errback(error as Error); 
        }
      });

      // Step 7: Start producing local media
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

  

      if (videoTrack && newProducerTransport) {
        videoProducerRef.current = await newProducerTransport.produce({
          track: videoTrack,
         encodings: [
  { rid: "r0", maxBitrate: 300000, scalabilityMode: "S1T3" },
  { rid: "r1", maxBitrate: 1200000, scalabilityMode: "S1T3" },
  { rid: "r2", maxBitrate: 3000000, scalabilityMode: "S1T3" }, 
],
codecOptions: {
  videoGoogleStartBitrate: 1500
}
        });
        console.log("✅ Video producer created", videoProducerRef.current.rtpParameters);
      }
      
      if (audioTrack && newProducerTransport) {
        audioProducerRef.current = await newProducerTransport.produce({ track: audioTrack });
        console.log("✅ Audio producer created");
      }

      await consumeNewMedia();

      setIsConnected(true);

      console.log("🎉 Successfully connected to MediaSoup room!");

    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Error connecting to room:", error.message);
      } else {
        console.error("An unexpected error occurred:", error);
      }
    } 
  };

  const disconnect = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current?.srcObject) {
      (remoteVideoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current?.srcObject) {
      (remoteAudioRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      remoteAudioRef.current.srcObject = null;
    }

    if (videoProducerRef.current) videoProducerRef.current.close();
    if (audioProducerRef.current) audioProducerRef.current.close();
    if (producerTransportRef.current) producerTransportRef.current.close();
    if (consumerTransportRef.current) consumerTransportRef.current.close();
    
    if (socketRef.current) socketRef.current.disconnect();

    videoProducerRef.current = null;
    audioProducerRef.current = null;
    producerTransportRef.current = null;
    consumerTransportRef.current = null;
    deviceRef.current = null;
    socketRef.current = null;
    localStreamRef.current = null;

    setIsConnected(false);
    console.log("🔌 Disconnected from room");
  };

  
  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    const videoProducer = videoProducerRef.current;
    if (!videoTrack || !videoProducer) return;

    if (isCameraOn) {
      videoProducer.pause();
      videoTrack.enabled = false;
    } else {
      videoProducer.resume();
      videoTrack.enabled = true;
    }
    setIsCameraOn(prev => !prev);
  };

  
  const toggleAudio = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    const audioProducer = audioProducerRef.current;
    if (!audioTrack || !audioProducer) return;

    if (isMicOn) {
      audioProducer.pause();
      audioTrack.enabled = false;
    } else {
      audioProducer.resume();
      audioTrack.enabled = true;
    }
    setIsMicOn(prev => !prev);
  };

  const handleShare = () => {
    console.log("Room URL:", window.location.href);
    
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 text-white px-4 py-10">
      <div className="absolute w-[30rem] h-[30rem] bg-white opacity-10 blur-[150px] rounded-full top-10 left-1/2 -translate-x-1/2 -z-10"></div>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between">
          <h1 className="text-4xl font-extrabold text-center drop-shadow-lg">
            MediaSoup Video Chat
          </h1>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6 items-center">
            {!isConnected ? (
              <button
                onClick={connectToRoom}
                className="px-8 py-3 text-lg font-semibold bg-green-500 hover:bg-green-600 text-white rounded-xl transition-all duration-200 shadow-md"
              >
                Join Room
              </button>
            ) : (
              <>
                <button
                  onClick={disconnect}
                  className="px-8 py-3 text-lg font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all duration-200 shadow-md"
                >
                  Leave Room
                </button>
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-md transition-all duration-200"
                >
                  <Copy size={18} />
                  Share Room URL
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Local Video */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-4 relative">
            <h2 className="text-lg font-semibold mb-3">📹 Your Video</h2>

            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-[28rem] bg-black/30 rounded-lg border border-white/30 object-cover"
              />

              {/* Connection status on video */}
              <div className="absolute top-4 left-4">
                <span className={`px-3 py-1 text-xs rounded-full font-semibold ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4">
                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full cursor-pointer transition-colors duration-200 ${
                    isCameraOn ? 'bg-white text-gray-800' : 'bg-red-500 text-white'
                  }`}
                  aria-label={isCameraOn ? 'Turn off video' : 'Turn on video'}
                >
                  {isCameraOn ? <Video /> : <VideoOff />}
                </button>
                <button
                  onClick={toggleAudio}
                  className={`p-3 rounded-full cursor-pointer transition-colors duration-200 ${
                    isMicOn ? 'bg-white text-gray-800' : 'bg-red-500 text-white'
                  }`}
                  aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
                >
                  {isMicOn ? <Mic /> : <MicOff />}
                </button>
              </div>
            </div>

            <audio ref={audioRef} autoPlay playsInline />
          </div>

          {/* Remote Video */}
          <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-4">
            <h2 className="text-lg font-semibold mb-3">🎥 Remote Video</h2>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-[28rem] bg-black/30 rounded-lg border border-white/30 object-cover"
            />
            <audio ref={remoteAudioRef} autoPlay playsInline />
          </div>
        </div>
      </div>
    </main>
  );
}
