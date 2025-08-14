import { Router } from 'mediasoup/node/lib/types';
import { mediasoupListenInfo } from '../config/medisoup.config';

export async function createWebRtcTransport(router: Router, cb: Function) {
  const transport = await router.createWebRtcTransport({
    listenIps: [mediasoupListenInfo],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 1000000,
  });

  cb({
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    },
  });

  return transport;
}
