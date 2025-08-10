import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import cors from "cors";
import dotenv from 'dotenv';


import { initializeSocketServer } from "./config/socket.config";
import setupMediasoup from "./controller/mediasoup.controller";

const app = express();
const server = http.createServer(app);
app.use(cors());
// dotenv.config();
const io: Server = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use('/watch', (req, res, next) => {
  if (req.url.endsWith('.m3u8')) {
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  } else if (req.url.endsWith('.ts')) {
    res.setHeader('Content-Type', 'video/MP2T');
  }
  next();
}, express.static(path.join(__dirname, '../public/hls')));

app.get("/", (req, res) => {
  res.send("Hello from server!");
});

const { stream } = initializeSocketServer(io);


(async () => {
  try {
    await setupMediasoup(stream);
    
    const PORT = process.env.PORT || 4001;
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Fatal error during server initialization:", error);
    process.exit(1);
  }
})();
