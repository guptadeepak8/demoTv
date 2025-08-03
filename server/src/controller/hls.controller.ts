import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { PlainTransportOptions, Producer, RtpParameters, Router, RtpCodecParameters } from 'mediasoup/node/lib/types';

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
  if (producer.kind !== 'video') {
    console.log(`[❌] Ignoring non-video producer (kind: ${producer.kind})`);
    return;
  }

  producers.push(producer);
  const basePort = 5004 + (transportInfos.length * 2); // e.g., 5004, 5006, 5008

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

  // Important: Request a keyframe for the new consumer immediately.
  // This helps decoders (like FFmpeg) to start processing the stream quickly,
  // especially when they join mid-stream.
  await consumer.requestKeyFrame(); 

  await consumer.resume();

  transportInfos.push({
    transport,
    consumer,
    rtpParameters: consumer.rtpParameters,
    rtpPort: basePort,
    rtcpPort: basePort + 1,
  });

  if (transportInfos.length === 2) {
    let sdpContent = ''; // Changed variable name to avoid confusion with `sdps` array later

    for (let i = 0; i < transportInfos.length; i++) {
      const t = transportInfos[i];
      sdpContent += generateSdpForSingle(t, 5004 + i * 2, 5005 + i * 2);
    }

    const hlsDir = path.join(__dirname, '../hls');
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }
    createMixedOutput(transportInfos)
  }
}

function generateSdpForSingle(t: TransportInfo, rtpPort: number, rtcpPort: number): string {
  const { rtpParameters } = t;
  const codec:RtpCodecParameters = rtpParameters.codecs?.[0];
  const encoding = rtpParameters.encodings?.[0];

  if (!codec || !encoding) {
    throw new Error("Invalid RTP parameters: missing codec or encoding");
  }

  const pt = codec.payloadType;
  const ssrc = encoding.ssrc;
  const mimeType = codec.mimeType.split('/')[1]; 
  const clockRate = codec.clockRate;

  let fmtpLine = '';

 
  if (codec.mimeType === 'video/VP8') {
    if (codec.parameters && Object.keys(codec.parameters).length > 0) {
      fmtpLine = `a=fmtp:${pt} ` + Object.entries(codec.parameters).map(([k, v]) => `${k}=${v}`).join(';') + `\r\n`;
    }
  }

  //for h264 video format
  //  else if (codec.mimeType === 'video/H264') {
  //   // Fallback for H264 
  //   const spropParameterSets = codec.parameters?.['sprop-parameter-sets'];
  //   if (!spropParameterSets && codec.mimeType === 'video/H264') {
  //      console.warn('[⚠️] Missing sprop-parameter-sets (SPS/PPS) in H264 codec. This may break decoding.');
  //   }
  //   let fmtpParams: string[] = [];
  //   for (const [k, v] of Object.entries(codec.parameters || {})) {
  //     if (k !== 'sprop-parameter-sets') {
  //       fmtpParams.push(`${k}=${v}`);
  //     }
  //   }
  //   if (spropParameterSets) {
  //     fmtpParams.push(`sprop-parameter-sets=${spropParameterSets}`);
  //   }
  //   fmtpLine = `a=fmtp:${pt} ` + fmtpParams.join(';') + `\r\n`;
  // }

  const sdp = `m=video ${rtpPort} RTP/AVP ${pt}\r\n` +
              `c=IN IP4 127.0.0.1\r\n` +
              `a=rtcp:${rtcpPort}\r\n` +
              `a=recvonly\r\n` +
              `a=rtpmap:${pt} ${mimeType}/${clockRate}\r\n` +
              fmtpLine + // This will be empty or very simple for VP8
              `a=ssrc:${ssrc} cname:mediasoup\r\n`;

  return `v=0\r\n` +
         `o=- 0 0 IN IP4 127.0.0.1\r\n` +
         `s=Mediasoup Mixed Stream\r\n` +
         `t=0 0\r\n` +
         sdp;
}

async function createMixedOutput(infos: TransportInfo[]) {
  const sdpFilePaths: string[] = []; 

  for (let i = 0; i < infos.length; i++) {
    const t = infos[i];
    const sdpContent = generateSdpForSingle(t, 5004 + i * 2, 5005 + i * 2);
    const sdpPath = path.join(__dirname, `../hls/input${i+1}.sdp`);
    fs.writeFileSync(sdpPath, sdpContent);
    sdpFilePaths.push(sdpPath);
  }

  const ffmpegArgs: string[] = [];

  sdpFilePaths.forEach(s => {
    ffmpegArgs.push('-protocol_whitelist', 'file,udp,rtp', '-i', s);
  });

  const filter = `[0:v]scale=426:240,setpts=PTS-STARTPTS[v0];[1:v]scale=426:240,setpts=PTS-STARTPTS[v1];[v0][v1]xstack=inputs=2:layout=0_0|0_h0[v]`;


 ffmpegArgs.push(
  '-loglevel', 'debug',
  '-probesize', '32M',
  '-analyzeduration', '32M',
  '-x264opts', 'keyint=48:min-keyint=48:no-scenecut',
  '-g', '48',
  '-force_key_frames', 'expr:gte(t,n_forced)',
  '-bsf:v', 'h264_mp4toannexb',
  '-filter_complex', filter,
  '-map', '[v]',
  '-s', '426x480',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-tune', 'zerolatency',
  '-b:v', '1500k',
  '-hls_time', '2',
  '-hls_list_size', '5',
  '-hls_flags', 'delete_segments',
  '-use_wallclock_as_timestamps', '1',

  path.join(__dirname, '../hls/stream.m3u8')
);


  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  ffmpeg.stderr.on('data', data => console.error(`FFmpeg stderr: ${data}`));
  ffmpeg.stdout.on('data', data => console.log(`FFmpeg stdout: ${data}`));
  ffmpeg.on('close', code => console.log(`FFmpeg exited with code ${code}`));
}

export const getActiveHlsStreams = () => {
  const isActive = fs.existsSync(HLS_PLAYLIST_PATH);
  return isActive
    ? [{ id: 'stream', url: 'http://localhost:4001/hls/stream.m3u8' }]
    : [];
};