'use client'
import { Copy, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
 const videoProducerRef = useRef<any>(null);
  const audioProducerRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [copied, setCopied] = useState(false);

  const [device, setDevice] = useState<any>(null);
  const [socket, setSocket] = useState<any>(null); // Keep state for re-renders if needed, but use ref for direct access
  const [producerTransport, setProducerTransport] = useState<any>(null);
  const [consumerTransport, setConsumerTransport] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [remotePeersCount, setRemotePeersCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");

    const [isCameraOn, setIsCameraOn] = useState(true)
  const [isMicOn, setIsMicOn] = useState(true)
    

  // --- NEW: Refs to hold the latest state values for event listeners and immediate access ---
  const deviceRef = useRef<any>(null);
  const consumerTransportRef = useRef<any>(null);
  const isConnectedRef = useRef(false);
  const socketRef = useRef<any>(null); // <--- NEW: Socket ref

  // Update refs whenever the corresponding state changes
  useEffect(() => {
    deviceRef.current = device;
  }, [device]);

  useEffect(() => {
    consumerTransportRef.current = consumerTransport;
  }, [consumerTransport]);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  useEffect(() => { // <--- NEW: Update socket ref
    socketRef.current = socket;
  }, [socket]);
  // --- END NEW REFS ---

  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []); 

  const initSocket = async () => {
      try {
        // Import socket.io-client dynamically to avoid SSR issues
        const { io } = await import("socket.io-client");
        const newSocket = io("http://localhost:4001/stream");
        
        setSocket(newSocket); // This updates the state
        // socketRef.current = newSocket; // Also update the ref immediately if you want to use it right after this line
                                       // However, it's safer to just pass newSocket to socketEmitPromise for initial calls

        newSocket.on("connection-success", (data) => {
          console.log("✅ Connected to server:", data);
          console.log("Client's Final Local SDP:", device?.rtpCapabilities); 
          setConnectionStatus("Connected to server");
        });

        newSocket.on("newProducer", ({ socketId, producerId, kind }) => {
          console.log(`🆕 New ${kind} producer from ${socketId}: ${producerId} (Event received)`);
          setRemotePeersCount(prev => prev + 1);
          
          // Use refs for the latest state in the closure
          if (isConnectedRef.current && consumerTransportRef.current && deviceRef.current) {
            console.log("Client: Calling handleNewProducer due to newProducer event.");
            handleNewProducer(socketId, producerId, kind); // handleNewProducer will use refs internally
          } else {
            console.log("Client: Not calling handleNewProducer, state not ready (newProducer event). isConnected:", isConnectedRef.current, "consumerTransport:", !!consumerTransportRef.current, "device:", !!deviceRef.current);
          }
        });

        newSocket.on("newProducerAvailable", async () => {
          console.log("🎉 New producer available! (Event received)");
          // Use refs for the latest state in the closure
          console.log("Client state on newProducerAvailable (via refs): isConnected:", isConnectedRef.current, "consumerTransport:", !!consumerTransportRef.current, "device:", !!deviceRef.current);
          if (isConnectedRef.current && consumerTransportRef.current && deviceRef.current) {
            console.log("Client: Calling consumeNewMedia due to newProducerAvailable.");
            await consumeNewMedia(deviceRef.current, consumerTransportRef.current); // Pass ref values
          } else {
            console.log("Client: Not calling consumeNewMedia, state not ready (newProducerAvailable event).");
          }
        });

        newSocket.on("peerDisconnected", ({ socketId }) => {
          console.log(`👋 Peer disconnected: ${socketId}`);
          setRemotePeersCount(prev => Math.max(0, prev - 1));
          // Clear remote video if that peer was being displayed
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
        });

        newSocket.on("connect_error", (error) => {
          console.error("❌ Socket connection error:", error);
          setConnectionStatus("Connection failed");
        });

      } catch (error) {
        console.error("❌ Failed to initialize socket:", error);
        setConnectionStatus("Failed to load socket.io");
      }
    };


  const socketEmitPromise = (event: string, data?: any, currentSocket?: any): Promise<any> => { // <--- MODIFIED: Added currentSocket parameter
    return new Promise((resolve, reject) => {
      // Use the provided currentSocket first, then fall back to socketRef.current
      const activeSocket = currentSocket || socketRef.current; 

      if (!activeSocket) { // <--- Use activeSocket here
        reject(new Error("Socket not connected")); 
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Socket emit timeout for event: ${event}`)); 
      }, 10000);

      const handler = (response: any) => {
        clearTimeout(timeout);
        resolve(response); // Always resolve, let the caller check for 'error' property
      };

      if (data !== undefined) {
        activeSocket.emit(event, data, handler); // <--- Use activeSocket here
      } else {
        activeSocket.emit(event, handler); // <--- Use activeSocket here
      }
    });
  };

  // Handle new producer joining
  const handleNewProducer = async (socketId: string, producerId: string, kind: string) => {
    // Use refs for the latest state in the function
    if (!isConnectedRef.current || !consumerTransportRef.current || !deviceRef.current) {
      console.log("handleNewProducer: State not ready for consumption (via refs).");
      return;
    }
    
    try {
      console.log(`🔄 Handling new ${kind} producer from ${socketId}...`);
      // Pass the ref values to consumeNewMedia
      await consumeNewMedia(deviceRef.current, consumerTransportRef.current); 
    } catch (error) {
      console.error("Error handling new producer:", error);
    }
  };

  // Consume new media from producers
  const consumeNewMedia = async (deviceArg?: any, consumerTransportArg?: any) => { 
    try {
      // Use the arguments if provided, otherwise fall back to state variables (which are now updated via refs)
      const usedDevice = deviceArg || device;
      const usedConsumerTransport = consumerTransportArg || consumerTransport;

      if (!usedDevice || !usedConsumerTransport) {
       
        setConnectionStatus("Connected - Waiting for device/transport");
        return;
      }

      console.log("Client: Emitting consumeMedia to server with RTP capabilities:", usedDevice.rtpCapabilities); 
      // Pass the actual socket instance (from ref) to socketEmitPromise
      const response = await socketEmitPromise("consumeMedia", {
        rtpCapabilities: usedDevice.rtpCapabilities 
      }, socketRef.current); // <--- NEW: Pass socketRef.current here

      console.log("Server response to consumeMedia:", response); 

      if (response?.params?.error) { 
        console.log(`ℹ️ Server reported: ${response.params.error}`);
        setConnectionStatus(`Connected - ${response.params.error}`);
        return;
      }
      if (response?.error) {
          console.log(`ℹ️ Server reported top-level error: ${response.error}`);
          setConnectionStatus(`Connected - ${response.error}`);
          return;
      }

      // CORRECTED: Direct access to response, as it's already the array
      const consumers = Array.isArray(response) ? response : (response ? [response] : []);

      console.log("Client: Processed consumers array length:", consumers.length); 
      console.log("Client: Processed consumers array content:", consumers); 


      if (consumers.length === 0) {
        console.log("ℹ️ No media to consume yet (after error check).");
        setConnectionStatus("Connected - Waiting for other users");
        return;
      }

      const videoTracks: MediaStreamTrack[] = [];
      const audioTracks: MediaStreamTrack[] = [];

      for (const consumerParams of consumers) {
        if (!consumerParams || !consumerParams.id) {
            console.warn("Invalid consumerParams received:", consumerParams);
            continue;
        }

        console.log(`Client: Attempting to consume producer ${consumerParams.producerId} (kind: ${consumerParams.kind})`); 
        const consumer = await usedConsumerTransport.consume({ 
          id: consumerParams.id,
          producerId: consumerParams.producerId,
          kind: consumerParams.kind,
          rtpParameters: consumerParams.rtpParameters,
        });

        if (consumer?.track) {
          console.log(`✅ Consumer created for ${consumer.kind}, track ID: ${consumer.track.id}`); 
          if (consumer.kind === "video") {
            videoTracks.push(consumer.track);
          } else if (consumer.kind === "audio") {
            audioTracks.push(consumer.track);
          }
        }
      }

      // Set up remote media streams
      if (videoTracks.length > 0 && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = new MediaStream(videoTracks);
        console.log("✅ Remote video stream set");
        setConnectionStatus("Connected - Receiving remote video");
      } else {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      }

      if (audioTracks.length > 0 && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = new MediaStream(audioTracks);
        console.log("✅ Remote audio stream set");
      } else {
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
      }

      // Resume consumers
      await socketEmitPromise("consumerResume", {}, socketRef.current); 
      console.log("✅ Consumers resumed");

    } catch (error) {
      console.error("Error consuming remote media (network/timeout):", error);
      setConnectionStatus(`Error: ${error.message}`);
    }
  };

  // Start local media
  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
      video: {
  width: { ideal: 640, max: 640 },
  height: { ideal: 360, max: 360 }
},
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (audioRef.current) {
        audioRef.current.srcObject = stream;
      }
      
      console.log("✅ Local media started");
      return stream;
    } catch (error) {
      console.error("❌ Error starting media:", error);
      throw error;
    }
  };

  // Main connection function
  const connectToRoom = async () => {
  

    setIsConnecting(true);
    setConnectionStatus("Connecting...");
    
    try {
      console.log("🚀 Starting MediaSoup connection...");
       initSocket()
      // Step 1: Start  local media
      const stream = await startMedia();
      localStreamRef.current = stream ; 
      setConnectionStatus("Local media started");

      // Step 2: Get RTP capabilities
      // Pass the newly created socket instance directly for the first few calls
      const rtpCapabilities = await socketEmitPromise("getRouterRtpCapabilities", undefined, socketRef.current); // <--- NEW: Pass socketRef.current

      setConnectionStatus("Got RTP capabilities");

      // Step 3: Create device (you'll need to import mediasoup-client)
      const { Device } = await import("mediasoup-client");
      const newDevice = new Device();
      await newDevice.load({ routerRtpCapabilities: rtpCapabilities });
      setDevice(newDevice);
      setConnectionStatus("Device loaded");

      // Step 4: Create producer transport
      const { params: producerParams } = await socketEmitPromise("createTransport", { sender: true }, socketRef.current); // <--- NEW: Pass socketRef.current
      
      const newProducerTransport = newDevice.createSendTransport(producerParams);
      
      newProducerTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketEmitPromise("connectProducerTransport", { dtlsParameters }, socketRef.current); // <--- NEW: Pass socketRef.current
          callback();
        } catch (error) {
          errback(error);
        }
      });

      newProducerTransport.on("produce", async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id } = await socketEmitPromise("transport-produce", { kind, rtpParameters }, socketRef.current); // <--- NEW: Pass socketRef.current
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      setProducerTransport(newProducerTransport);
      setConnectionStatus("Producer transport created");

      // Step 5: Create consumer transport
      const { params: consumerParams } = await socketEmitPromise("createTransport", { sender: false }, socketRef.current); // <--- NEW: Pass socketRef.current
      const newConsumerTransport = newDevice.createRecvTransport(consumerParams);
      
      newConsumerTransport.on("connect", async ({ dtlsParameters }, callback, errback) => {
        try {
          await socketEmitPromise("connectConsumerTransport", { dtlsParameters }, socketRef.current); // <--- NEW: Pass socketRef.current
          callback();
        } catch (error) {
          errback(error);
        }
      });

      setConsumerTransport(newConsumerTransport);
      setConnectionStatus("Consumer transport created");

      // Step 6: Start producing
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
           videoProducerRef.current =await newProducerTransport.produce({
          track: videoTrack,
          encodings: [
            { rid: "r0", maxBitrate: 100000, scalabilityMode: "S1T3" },
            { rid: "r1", maxBitrate: 300000, scalabilityMode: "S1T3" },
            { rid: "r2", maxBitrate: 900000, scalabilityMode: "S1T3" },
          ],
        });
        console.log("✅ Video producer created",videoProducerRef.current.rtpParameters);
      }
      
      if (audioTrack) {
        audioProducerRef.current= await newProducerTransport.produce({ track: audioTrack });
        console.log("✅ Audio producer created");
      }

      // Step 7: Try to consume existing media
      // Pass the newly created device and consumerTransport directly
      await consumeNewMedia(newDevice, newConsumerTransport);

      setIsConnected(true);
      setConnectionStatus("Connected - Ready");
      console.log("🎉 Successfully connected to MediaSoup room!");

    } catch (error) {
      console.error("💥 Connection failed:", error);
      setConnectionStatus(`Failed: ${error.message}`);
     
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect function
  const disconnect = () => {
    // Stop all tracks
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current?.srcObject) {
      const stream = remoteVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      remoteVideoRef.current.srcObject = null;
    }

    // Close transports
    if (producerTransport) {
      producerTransport.close();
    }
    if (consumerTransport) {
      consumerTransport.close();
    }

    // Reset state
    setIsConnected(false);
    setDevice(null);
    setProducerTransport(null);
    setConsumerTransport(null);
    setRemotePeersCount(0);
    setConnectionStatus("Disconnected");
    
    console.log("🔌 Disconnected from room");
  };

  const toggleVideo = () => {
    if (!localStreamRef.current || !videoProducerRef.current) return;

    if (isCameraOn) {
      videoProducerRef.current.pause();
      localStreamRef.current.getVideoTracks()[0].enabled = false;
    } else {
      videoProducerRef.current.resume();
      localStreamRef.current.getVideoTracks()[0].enabled = true;
    }
    setIsCameraOn(prev=>!prev);
  };

  const toggleAudio = () => {
    if (!localStreamRef.current || !audioProducerRef.current) return;

    if (isMicOn) {
      audioProducerRef.current.pause();
      localStreamRef.current.getAudioTracks()[0].enabled = false;
    } else {
      audioProducerRef.current.resume();
      localStreamRef.current.getAudioTracks()[0].enabled = true;
    }
    setIsMicOn(prev=>!prev);
  };
  const handleShare = () => {
  navigator.clipboard.writeText(window.location.href);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
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

        {/* Controls */}
      
      </div>
    </main>
     
  );
}
