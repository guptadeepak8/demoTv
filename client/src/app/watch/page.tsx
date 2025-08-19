"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Copy, VideoOff } from "lucide-react";

export default function WatchPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const streamUrl = `/watch/stream.m3u8`;
    const videoElement = videoRef.current;

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    if (!videoElement) return cleanup;

    setError(null);

    if (Hls.isSupported()) {
      hlsRef.current = new Hls();
      hlsRef.current.loadSource(streamUrl);
      hlsRef.current.attachMedia(videoElement);

      hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
        console.error(`HLS.js error:`, event, data);
        if (data.fatal) {
          cleanup();
          setError(`Fatal stream error: ${data.details}.`);
        }
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = streamUrl;
      videoElement.addEventListener(
        'loadedmetadata',
        () => {
          videoElement.play().catch((e) => {
            console.error("Native play failed:", e);
            setError("Native playback failed.");
          });
        },
        { once: true }
      );
    } else {
      setError("HLS is not supported in this browser.");
    }

    return cleanup;
  }, []);

  const handleShare = () => {
    console.log("helo")
  };

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 text-white px-4 py-10">
      <div className="absolute w-[30rem] h-[30rem] bg-white opacity-10 blur-[150px] rounded-full top-10 left-1/2 -translate-x-1/2 -z-10"></div>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-extrabold text-center drop-shadow-lg">
            Live Stream Viewer
          </h1>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-md transition-all duration-200"
          >
            <Copy size={18} />
            Share Watch URL
          </button>
        </div>
        <div className="flex justify-center">
          <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-lg border border-white/20 p-4 relative w-full max-w-3xl">
            <h2 className="text-lg font-semibold mb-3">📺 Mixed Stream</h2>

            {error ? (
              <div className="flex flex-col items-center justify-center h-[30rem] text-red-300 text-center">
                <VideoOff className="h-16 w-16 text-red-500 mb-4 animate-pulse" />
                <p className="text-lg font-medium">Couldn&apos;t load the video</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            ) : (
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  controls
                  className="w-full h-[30rem] bg-black/30 rounded-lg border border-white/30 object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
