import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import {
  PlainTransportOptions,
  Producer,
  RtpParameters,
  Router,
  RtpCodecParameters,
} from 'mediasoup/node/lib/types';

let router: Router;
const producers: Producer[] = [];

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

export async function addProducerToMix(producer: Producer) {


  producers.push(producer);
  const basePort = 5004 + transportInfos.length * 2;

  const transport = await router.createPlainTransport<PlainTransportOptions>({
    listenIp: '127.0.0.1',
    rtcpMux: false,
    comedia: false,
  });

  await transport.connect({
    ip: '127.0.0.1',
    port: basePort,
    rtcpPort: basePort + 1,
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
    rtpPort: basePort,
    rtcpPort: basePort + 1,
  });

  if (transportInfos.length === 4) {
    const hlsDir = path.join(__dirname, '../hls');
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }
    createMixedOutput(transportInfos);
  }
}

function generateSdpMediaSection(
  t: TransportInfo,
  rtpPort: number,
  rtcpPort: number
): string {
  const { rtpParameters } = t;
  const codec: RtpCodecParameters = rtpParameters.codecs?.[0];
  const encoding = rtpParameters.encodings?.[0];

  if (!codec || !encoding) {
    throw new Error('Invalid RTP parameters: missing codec or encoding');
  }

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

  const sdp =
    `m=${mediaType} ${rtpPort} RTP/AVP ${pt}\r\n` +
    `c=IN IP4 127.0.0.1\r\n` +
    `a=rtcp:${rtcpPort}\r\n` +
    `a=recvonly\r\n` +
    `a=rtpmap:${pt} ${mimeType}/${clockRate}\r\n` +
    fmtpLine +
    `a=ssrc:${ssrc} cname:mediasoup\r\n`;

  return sdp;
}


async function createMixedOutput(infos: TransportInfo[]) {
  const sessionHeader =
    `v=0\r\n` +
    `o=- 0 0 IN IP4 127.0.0.1\r\n` +
    `s=Mediasoup Mixed Stream\r\n` +
    `t=0 0\r\n`;

  let mediaSections = '';
  for (let i = 0; i < infos.length; i++) {
    const t = infos[i];
    mediaSections += generateSdpMediaSection(t, 5004 + i * 2, 5005 + i * 2);
  }

  const fullSdp = sessionHeader + mediaSections;
  const sdpPath = path.join(__dirname, '../hls/combined.sdp');
  fs.writeFileSync(sdpPath, fullSdp);

  const filter=`[0:v:0]scale=427:480[v0];[0:a:0]anull[a0];[0:v:1]scale=427:480[v1];[v0][v1]xstack=inputs=2:layout=0_0|w0_0[v];[a0][a1]amix=inputs=2[a]`

  const ffmpegArgs = [
    '-protocol_whitelist', 'file,udp,rtp',
    '-i', sdpPath,
    '-loglevel', 'debug',
    '-probesize', '32M',
    '-analyzeduration', '32M',
    '-x264opts', 'keyint=48:min-keyint=48:no-scenecut',
    '-g', '48',
    '-force_key_frames', 'expr:gte(t,n_forced)',
    '-bsf:v', 'h264_mp4toannexb',
    '-filter_complex',filter,
    '-map', '[v]',
    '-map', '[a]',
    '-s', '854x480',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-b:v', '1500k',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-hls_time', '2',
    '-hls_list_size', '5',
    '-hls_flags', 'delete_segments',
    path.join(__dirname, '../hls/stream.m3u8'),
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  ffmpeg.stderr.on('data', (data) => console.error(`FFmpeg stderr: ${data}`));
  ffmpeg.stdout.on('data', (data) => console.log(`FFmpeg stdout: ${data}`));
  ffmpeg.on('close', (code) =>
    console.log(`FFmpeg exited with code ${code}`)
  );
}

export const getActiveHlsStreams = () => {
  const isActive = fs.existsSync(HLS_PLAYLIST_PATH);
  return isActive
    ? [{ id: 'stream', url: 'http://localhost:4001/hls/stream.m3u8' }]
    : [];
};
