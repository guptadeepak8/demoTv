
import { RtpCapabilities, RtpCodecCapability, TransportListenInfo, Worker } from 'mediasoup/node/lib/types';
import dotenv from 'dotenv'

dotenv.config()

export const mediasoupListenInfo: TransportListenInfo = {
  protocol:'udp',
  ip: String(process.env.MEDIASOUP_LISTEN_IP), 
  announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP, 
  portRange: {
    min: Number(process.env.MEDIASOUP_MIN_PORT),
    max: Number(process.env.MEDIASOUP_MAX_PORT),
  },
};

 export const mediaCodecs: RtpCodecCapability[] = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
 {
    kind       : "video",
     mimeType: "video/VP8",
    clockRate  : 90000,
    
  }
];

export const routerRtpCapabilities: RtpCapabilities = {
  codecs: mediaCodecs,
  headerExtensions: [] 
};
