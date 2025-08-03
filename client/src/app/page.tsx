'use client';

import { useRouter } from 'next/navigation';


export default function HomePage() {
  const router = useRouter();

  const handleStartStreaming = () => {
    router.push(`/stream`);
  };

  const handleWatchStream = () => {
    router.push(`/watch`);
  };

  return (
    <main className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-600 text-white overflow-hidden px-4">
      {/* Glowing background blob */}
      <div className="absolute w-[30rem] h-[30rem] bg-white opacity-10 blur-[150px] rounded-full top-10 left-1/3 -z-10"></div>

      <h1 className="text-5xl md:text-6xl font-extrabold drop-shadow-lg text-center">
        Welcome to LiveConnect
      </h1>
      <p className="mt-4 text-lg md:text-xl text-white/80 text-center max-w-xl">
        Choose whether you want to start your own stream or watch someone else live.
      </p>

      <div className="mt-12 flex flex-col md:flex-row gap-6">
        <button
          onClick={handleStartStreaming}
          className="px-8 py-5 text-xl font-semibold bg-green-500 hover:bg-green-600 transition-all duration-200 rounded-2xl shadow-lg hover:scale-105"
        >
          🚀 Start Streaming
        </button>

        <button
          onClick={handleWatchStream}
          className="px-8 py-5 text-xl font-semibold bg-blue-500 hover:bg-blue-600 transition-all duration-200 rounded-2xl shadow-lg hover:scale-105"
        >
          👀 Watch a Stream
        </button>
      </div>

      <footer className="absolute bottom-6 text-sm text-white/60">
        Built with ❤️ by Deepak
      </footer>
    </main>
  );
}
