// src/app/watch/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import Hls from 'hls.js';

// The HlsStream interface is updated to match the server's output
interface HlsStream {
  id: string; 
  url: string; 
}

export default function WatchPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [activeStreams, setActiveStreams] = useState<HlsStream[]>([{}]);
  const [connectionStatus, setConnectionStatus] = useState("Connecting to server...");

  const hlsInstancesRef = useRef<Map<string, Hls>>(new Map());

  useEffect(() => {
    const newSocket = io("http://localhost:4001/watch");

    newSocket.on("connect", () => {
      console.log("📺 Watch client connected to server.");
      setConnectionStatus("Connected to server.");
      setSocket(newSocket);

      // Request existing HLS streams immediately upon connection
      newSocket.emit("getHlsStreams", (streams: HlsStream[]) => {
        console.log("📺 Received initial HLS streams:", streams);
        setActiveStreams(streams);
      });
    });

    newSocket.on("newHlsStream", (stream: HlsStream) => {
      console.log("📺 New HLS stream available:", stream);
      // The server only sends a single, mixed stream. We just set it.
      setActiveStreams([stream]);
    });

    // The hlsStreamRemoved event now receives an object with an 'id'
    newSocket.on("hlsStreamRemoved", ({ id }: { id: string }) => {
      console.log("📺 HLS stream removed:", id);
      // Clear all streams since the single mixed stream was removed
      setActiveStreams([]);
      // Clean up Hls.js instance
      if (hlsInstancesRef.current.has(id)) {
        hlsInstancesRef.current.get(id)?.destroy();
        hlsInstancesRef.current.delete(id);
      }
    });

    newSocket.on("disconnect", () => {
      console.log("📺 Watch client disconnected from server.");
      setConnectionStatus("Disconnected from server.");
      setActiveStreams([]);
      hlsInstancesRef.current.forEach(hls => hls.destroy());
      hlsInstancesRef.current.clear();
    });

    newSocket.on("connect_error", (error) => {
      console.error("📺 Socket connection error:", error);
      setConnectionStatus(`Connection error: ${error.message}`);
    });

    return () => {
      newSocket.disconnect();
      hlsInstancesRef.current.forEach(hls => hls.destroy());
      hlsInstancesRef.current.clear();
    };
  }, []);

  useEffect(() => {
    activeStreams.forEach(stream => {

      const videoElement = document.getElementById(`video-${stream.id}`) as HTMLVideoElement;
      if (videoElement && Hls.isSupported() && !hlsInstancesRef.current.has(stream.id)) {
        const hls = new Hls();
        hls.loadSource(stream.url);
        hls.attachMedia(videoElement);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch(e => console.error(`Error playing video for ${stream.id}:`, e));
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error(`HLS.js error for ${stream.id}:`, event, data);
          if (data.fatal) {
            switch(data.type) {
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
                setActiveStreams(prev => prev.filter(s => s.id !== stream.id));
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
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Live Stream Watcher</h1>
      
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <p><strong>Connection Status:</strong> {connectionStatus}</p>
        <p><strong>Active HLS Streams:</strong> {activeStreams.length}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeStreams.length === 0 ? (
          <p className="col-span-full text-center text-gray-500">
            Waiting for a mixed live stream to become available...
          </p>
        ) : (
          activeStreams.map(stream => (
            // Use stream.id as the key
            <div key={stream.id} className="bg-white rounded-lg shadow-md p-4">
              <h2 className="text-lg font-semibold mb-3">
                🎉 Mixed Stream
              </h2>
              <video 
                // Use stream.id to set a unique video element id
                id={`video-${stream.id}`}
                controls
                autoPlay 
                playsInline 
                muted
                className="w-full h-64 bg-gray-100 rounded border object-cover"
              />
              <p className="text-sm text-gray-600 mt-2">
                (Combined video and audio from multiple users)
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
        <h3 className="font-semibold mb-2">📋 How to test:</h3>
        <ul className="space-y-1 text-gray-700">
          <li>• Ensure your Node.js MediaSoup server is running on localhost:4001.</li>
          <li>• Open `/stream` in **two separate** browser tabs (e.g., User 1, User 2) and click "Join Room" in both.</li>
          <li>• Open `/watch` in a separate browser tab (e.g., User 3).</li>
          <li>• Once both User 1 and User 2 start streaming video and audio, you should see a **single mixed video feed** appear on the `/watch` page.</li>
          <li>• If either User 1 or User 2 disconnects from `/stream`, the mixed feed should disappear from `/watch`.</li>
        </ul>
      </div>
    </div>
  );
}