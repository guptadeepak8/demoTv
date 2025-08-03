import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import cors from "cors";

import { initializeSocketServer } from "./config/socket.config";
import { getActiveHlsStreams } from "./controller/hls.controller";
import setupMediasoup from "./controller/mediasoup.controller";

const app = express();
const server = http.createServer(app);
app.use(cors());

const io: Server = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use("/hls", express.static(path.join(__dirname, "./hls")));

app.get("/", (req, res) => {
  res.send("Hello from server!");
});

const { peers, watch } = initializeSocketServer(io);

(async () => {
  try {
   await setupMediasoup(peers);
    watch.on("connection", (socket: Socket) => {
      socket.on("getHlsStreams", (callback) => {
        const activeStreams = getActiveHlsStreams();
        callback(activeStreams);
        console.log(`[Watch Socket] Sent active HLS streams to ${socket.id}:`);
        if (activeStreams.length > 0) {
          io.of("/watch").emit("streamAvailable", activeStreams);
          console.log("[Server] Emitted streamAvailable to /watch");
        }
      });

      socket.on("disconnect", () => {
        console.log(
          `[Watch Socket] Client disconnected from /watch namespace: ${socket.id}`
        );
      });
    });

    const PORT = process.env.PORT || 4001;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Fatal error during server initialization:", error);
    process.exit(1);
  }
})();
