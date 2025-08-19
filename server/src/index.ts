import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import path from "path";
import cors from "cors";
import expressStatusMonitor from 'express-status-monitor'
import fs from "fs";
import https from "https"; 

import { initializeSocketServer } from "./config/socket.config";
import setupMediasoup from "./controller/mediasoup.controller";


const app = express();
const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');
const credentials = { key: privateKey, cert: certificate };

// Use the https module to create the server
const server = https.createServer(credentials, app);

app.use(expressStatusMonitor())
app.use(cors());

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
    
    const PORT = Number(process.env.PORT) || 4001;


    server.listen(PORT,'0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Fatal error during server initialization:", error);
    process.exit(1);
  }
})();
