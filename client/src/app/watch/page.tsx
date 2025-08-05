// src/app/watch/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import Hls from "hls.js";
import { Copy, VideoOff } from "lucide-react";


interface HlsStream {
  id: string;
  url: string;
}

export default function WatchPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeStreams, setActiveStreams] = useState<HlsStream[]>([]);
  const [connectionStatus, setConnectionStatus] = useState(
    "Connecting to server..."
  );

  const hlsInstancesRef = useRef<Map<string, Hls>>(new Map());

  useEffect(() => {
    const newSocket = io("http://localhost:4001/watch");

    newSocket.on("connect", () => {
      console.log("📺 Watch client connected to server.");
      setConnectionStatus("Connected to server.");
      setSocket(newSocket);

      
      newSocket.emit("getHlsStreams", (streams: HlsStream[]) => {
        console.log("📺 Received initial HLS streams:", streams);
        setActiveStreams(streams);
      });
    });

    newSocket.on("newHlsStream", (stream: HlsStream) => {
      console.log("📺 New HLS stream available:", stream);
      setActiveStreams([stream]);
    });


    newSocket.on("hlsStreamRemoved", ({ id }: { id: string }) => {
      console.log("📺 HLS stream removed:", id);
      setActiveStreams([]);
      if (hlsInstancesRef.current.has(id)) {
        hlsInstancesRef.current.get(id)?.destroy();
        hlsInstancesRef.current.delete(id);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("📺 Watch client disconnected from server.");
      setConnectionStatus("Disconnected from server.");
      setActiveStreams([]);
      hlsInstancesRef.current.forEach((hls) => hls.destroy());
      hlsInstancesRef.current.clear();
    });

    newSocket.on("connect_error", (error) => {
      console.error("📺 Socket connection error:", error);
      setConnectionStatus(`Connection error: ${error.message}`);
    });

    return () => {
      newSocket.disconnect();
      hlsInstancesRef.current.forEach((hls) => hls.destroy());
      hlsInstancesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    activeStreams.forEach((stream) => {
      const videoElement = document.getElementById(
        `video-${stream.id}`
      ) as HTMLVideoElement;
      if (
        videoElement &&
        Hls.isSupported() &&
        !hlsInstancesRef.current.has(stream.id)
      ) {
        const hls = new Hls();
        if (stream?.url?.trim()) {
          hls.loadSource(stream.url.trim());
          hls.attachMedia(videoElement);
        } else {
          console.error("❌ stream.url is undefined or invalid:", stream);
        }
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement
            .play()
            .catch((e) =>
              console.error(`Error playing video for ${stream.id}:`, e)
            );
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error(`HLS.js error for ${stream.id}:`, event, data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error("Fatal network error, trying to recover...");
                hls.recoverMediaError();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error("Fatal media error, trying to recover...");
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                hlsInstancesRef.current.delete(stream.id);
                setActiveStreams((prev) =>
                  prev.filter((s) => s.id !== stream.id)
                );
                break;
            }
          }
        });
        hlsInstancesRef.current.set(stream.id, hls);
        console.log(`📺 Initialized Hls.js for ${stream.id} at ${stream.url}`);
      }
    });
  }, [activeStreams]);

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 text-white px-4 py-10">
      <div className="absolute w-[30rem] h-[30rem] bg-white opacity-10 blur-[150px] rounded-full top-10 left-1/2 -translate-x-1/2 -z-10"></div>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between">
          <h1 className="text-4xl font-extrabold text-center drop-shadow-lg">
            Live Stream Viewer
          </h1>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6 items-center">
            <button
              onClick={() =>
                navigator.clipboard.writeText(window.location.href)
              }
              className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-md transition-all duration-200"
            >
              <Copy size={18} />
              Share Watch URL
            </button>
          </div>
        </div>

        <div className="flex justify-center">
  <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-4 relative w-full max-w-3xl">
    <h2 className="text-lg font-semibold mb-3">📺 Mixed Stream</h2>

    {!activeStreams.length ? (
      <div className="flex flex-col items-center justify-center h-[30rem] text-white/80 text-center">
        <VideoOff className="h-16 w-16 text-white/60 mb-4 animate-pulse" />
        <p className="text-lg font-medium">No one is streaming right now.</p>
        <p className="text-sm mt-1">Please wait or refresh the page shortly.</p>
      </div>
    ) : (
      <div className="relative">
        <video
          id={`video-${activeStreams[0].id}`}
          autoPlay
          playsInline
          muted
          controls
          className="w-full h-[30rem]  bg-black/30 rounded-lg border border-white/30 object-cover"
        />

        <div className="absolute top-4 left-4">
          <span
            className={`px-3 py-1 text-xs rounded-full font-semibold ${
              connectionStatus === "Connected to server."
                ? "bg-green-500"
                : "bg-red-500"
            }`}
          >
            {connectionStatus}
          </span>
        </div>
      </div>
    )}
  </div>
</div>
      </div>
    </main>
  );
}
