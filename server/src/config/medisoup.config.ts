
import { RtpCapabilities, RtpCodecCapability, TransportListenInfo, Worker } from 'mediasoup/node/lib/types';

export const mediasoupListenInfo: TransportListenInfo = {
  protocol:'udp',
  ip: '127.0.0.1', 
  announcedIp: '127.0.0.1', 
  portRange: {
    min: 10000,
    max: 60000,
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
