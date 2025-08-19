import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  PlainTransportOptions,
  Producer,
  RtpParameters,
  Router,
} from 'mediasoup/node/lib/types';
import dotenv from 'dotenv'
import dgram from 'dgram';

dotenv.config()

let router: Router;
let producers: Producer[] = [];

let ffmpegProcess: ReturnType<typeof spawn> | null = null;
const HLS_PLAYLIST_PATH = path.resolve(__dirname, '../hls/stream.m3u8');

interface TransportInfo {
  transport: any;
  consumer: any;
  rtpParameters: RtpParameters;
  rtpPort: number;
  rtcpPort: number;
}

const transportInfos: TransportInfo[] = [];

export async function initHlsManager(r: Router) {
  router = r;
}

function getFreeUdpPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.bind(0, () => {
      const port = (socket.address() as any).port;
      socket.close(() => resolve(port));
    });
    socket.on("error", reject);
  });
}

export async function addProducerToMix(producer: Producer) {

  const rtpPort = await getFreeUdpPort();
const rtcpPort = await getFreeUdpPort();
  producers.push(producer);
  
  const transport = await router.createPlainTransport<PlainTransportOptions>({
    listenIp: String(process.env.MEDIASOUP_LISTEN_IP),
    rtcpMux: false,
    comedia: false,
  });

  await transport.connect({
    ip: String(process.env.MEDIASOUP_LISTEN_IP),
    port: rtpPort,
    rtcpPort: rtcpPort,
  });

  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities: router.rtpCapabilities,
    paused: false,
  });

  await consumer.requestKeyFrame();
  await consumer.resume();

  transportInfos.push({
    transport,
    consumer,
    rtpParameters: consumer.rtpParameters,
    rtpPort: rtpPort,
    rtcpPort: rtcpPort,
  });

  if (transportInfos.length === 4) {
    createMixedOutput(transportInfos);
  }
}

function generateSdpMediaSection(t: TransportInfo, rtpPort: number, rtcpPort: number): string {
  const { rtpParameters } = t;
  const codec = rtpParameters.codecs?.[0];
  const encoding = rtpParameters.encodings?.[0];
  if (!codec || !encoding) throw new Error('Invalid RTP parameters');

  const pt = codec.payloadType;
  const ssrc = encoding.ssrc;
  const mimeType = codec.mimeType.split('/')[1];
  const clockRate = codec.clockRate;

  let fmtpLine = '';
  if (codec.parameters && Object.keys(codec.parameters).length > 0) {
    fmtpLine =
      `a=fmtp:${pt} ` +
      Object.entries(codec.parameters)
        .map(([k, v]) => `${k}=${v}`)
        .join(';') +
      `\r\n`;
  }

  const mediaType = codec.mimeType.startsWith('audio') ? 'audio' : 'video';

  return (
    `m=${mediaType} ${rtpPort} RTP/AVP ${pt}\r\n` +
    `c=IN IP4 ${process.env.MEDIASOUP_LISTEN_IP}\r\n` +
    `a=rtcp:${rtcpPort}\r\n` +
    `a=recvonly\r\n` +
    `a=rtpmap:${pt} ${mimeType}/${clockRate}\r\n` +
    fmtpLine +
    `a=ssrc:${ssrc} cname:mediasoup\r\n`
  );
}



async function createMixedOutput(infos: TransportInfo[]) {

  const hlsDir = path.join(__dirname, '../../public/hls');
  if (!fs.existsSync(hlsDir)) fs.mkdirSync(hlsDir, { recursive: true });
 
  const videoInfos = infos.filter(i => i.consumer.kind === 'video');
  const audioInfos = infos.filter(i => i.consumer.kind === 'audio');
  const sortedInfos = [...videoInfos, ...audioInfos];

  const sessionHeader = 
    `v=0\r\n` +
    `o=- 0 0 IN IP4 ${process.env.MEDIASOUP_LISTEN_IP}\r\n` +
    `s=Mediasoup Mixed Stream\r\n` +
    `t=0 0\r\n`;

  
  let mediaSections = '';
  sortedInfos.forEach(t => {
    mediaSections += generateSdpMediaSection(t, t.rtpPort, t.rtcpPort);
  });

  const sdpPath = path.join(hlsDir, 'input.sdp');
  fs.writeFileSync(sdpPath, sessionHeader + mediaSections);

 
  const filterComplex = `
    [0:v:0]scale=427:480[v0];
    [0:v:1]scale=427:480[v1];
    [v0][v1]xstack=inputs=2:layout=0_0|w0_0[v];
    [0:a:0]anull[a0];
    [0:a:1]anull[a1];
    [a0][a1]amix=inputs=2[a]
  `.replace(/\s+/g, '');

  const ffmpegArgs = [
    '-protocol_whitelist', 'file,udp,rtp',
    '-max_delay', '500000',
    '-probesize', '5000000',
    '-analyzeduration', '5000000',
    '-i', sdpPath,
    '-loglevel', 'debug',
    '-x264opts', 'keyint=48:min-keyint=48:no-scenecut',
    '-filter_complex', filterComplex,
    '-map', '[v]',
    '-map', '[a]',
    '-b:v', '1000k',
    '-c:v', 'libx264',
   '-preset', 'veryfast',
    '-tune', 'zerolatency', // Add this to prioritize speed
    '-c:a', 'aac',
    '-b:a', '96k',
    '-hls_time', '1', // Reduced to 1-second segments
    '-hls_list_size', '3', // Reduced playlist to 3 segments
    '-hls_flags', 'delete_segments',
    '-f', 'hls',
    path.join(hlsDir, 'stream.m3u8')
  ];

  ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

  ffmpegProcess.stdout?.on('data', data => console.log(`FFmpeg stdout: ${data}`));
  ffmpegProcess.stderr?.on('data', data => console.error(`FFmpeg stderr: ${data}`));
  ffmpegProcess.on('close', code => {
    console.log(`FFmpeg exited with code ${code}`)
    ffmpegProcess = null;
    clearhhls()
  });
}

export function stopHls() {
  console.log("Stopping HLS stream...");
  if (ffmpegProcess && ffmpegProcess?.stdin) {
    ffmpegProcess.stdin.end();
  } else {
    console.log("No FFmpeg process to stop.");
    clearhhls();
  }
}

function clearhhls(){
  const hlsDir = path.join(__dirname, '../../public/hls');
  
  if (fs.existsSync(hlsDir) && !ffmpegProcess) {
    fs.rmSync(hlsDir, { recursive: true, force: true });
    console.log('🗑️ HLS folder deleted');
  }
}

export const getActiveHlsStreams = () => {
  const isActive = fs.existsSync(HLS_PLAYLIST_PATH);
  return isActive
    ? [{ id: 'stream', url: 'http://localhost:4001/watch/stream.m3u8' }]
    : [];
};

export async function removeProducerFromMix(producerId: string) {
  // Remove the producer and its transport info
  producers = producers.filter(p => p.id !== producerId);
  const idx = transportInfos.findIndex(t => t.consumer.producerId === producerId);
  if (idx >= 0) {
    const [removedInfo] = transportInfos.splice(idx, 1);
    removedInfo.transport.close();
    removedInfo.consumer.close();
  }

  const videoInfos = transportInfos.filter(i => i.consumer.kind === 'video');

  // If there are still video producers, update the SDP file and let FFmpeg
  // handle it. Do not restart the process.
  if (videoInfos.length === 0) {
    // If no video producers are left, stop the FFmpeg process
    stopHls();
  }
}