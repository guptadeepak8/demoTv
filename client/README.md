This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


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
    