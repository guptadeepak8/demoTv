import { Namespace, Socket } from 'socket.io';
import { Worker, Router, WebRtcTransport, AppData, Producer, Consumer } from 'mediasoup/node/lib/types';
import { initHlsManager, stopHls } from './hls.controller';

import { mediaCodecs } from '../config/medisoup.config';
import { createWebRtcTransport } from './transport.controller';
import { handleProduce } from './producer.controller';
import { handleConsume } from './consumer.controller';
import { createMediaWorker } from '../common/worker';

let worker: Worker<AppData>
let router: Router<AppData>;



export default async function setupMediasoup(peers: Namespace) {
  worker = await createMediaWorker();
 
  router = await worker.createRouter({ mediaCodecs });
  initHlsManager(router);

  const transports = new Map<string, { producerTransport?: WebRtcTransport; consumerTransport?: WebRtcTransport }>();
  const producers = new Map<string, Record<string, Producer>>();
  const consumers = new Map<string, Consumer[]>();

  peers.on("connection", async (socket: Socket) => {
    transports.set(socket.id, {});
    producers.set(socket.id, {});
    consumers.set(socket.id, []);
    socket.emit("connection-success", { socketId: socket.id });

    const userTransports = transports.get(socket.id)!;

    socket.on("getRouterRtpCapabilities", cb => cb(router.rtpCapabilities));

    socket.on("createTransport", async ({ sender }, cb) => {
      try {
        const transport = await createWebRtcTransport(router, cb);
        if (sender) userTransports.producerTransport = transport;
        else userTransports.consumerTransport = transport;
      } catch (err) {
        cb({ error: err });
      }
    });

    socket.on("connectProducerTransport", async ({ dtlsParameters }, cb) => {
      await userTransports.producerTransport?.connect({ dtlsParameters });
      cb?.({ connected: true });
    });

    socket.on("transport-produce", async ({ kind, rtpParameters }, cb) => {
      const producer = await handleProduce(socket, kind, rtpParameters, userTransports.producerTransport, producers);
      cb({ id: producer.id });
    });

    socket.on("connectConsumerTransport", async ({ dtlsParameters }, cb) => {
      await userTransports.consumerTransport?.connect({ dtlsParameters });
      cb?.({ connected: true });
    });

    socket.on("consumeMedia", async ({ rtpCapabilities }, cb) => {
      const result = await handleConsume(router, userTransports.consumerTransport, rtpCapabilities, producers, consumers, socket);
      cb(result);
    });

    socket.on("consumerResume", async (_, cb) => {
      const list = consumers.get(socket.id);
      if (!list || list.length === 0) return cb?.({ error: "No consumers" });

      for (const c of list) {
        if (c.paused) await c.resume();
      }
      cb?.({ resumed: true, count: list.length });
    });

    socket.on("disconnect", () => {
      for (const p of Object.values(producers.get(socket.id) || {})) p?.close();
      producers.delete(socket.id);

      for (const c of consumers.get(socket.id) || []) c?.close();
      consumers.delete(socket.id);

      userTransports.producerTransport?.close();
      userTransports.consumerTransport?.close();
      transports.delete(socket.id);
      stopHls()
    });
  });

  return router;
}
