import { MediaKind, Producer, RtpCodecParameters, WebRtcTransport } from 'mediasoup/node/lib/types';
import { Socket } from 'socket.io';
import { addProducerToMix, removeProducerFromMix } from './hls.controller';

export async function handleProduce(
  socket: Socket,
  kind: MediaKind,
  rtpParameters: any,
  transport: WebRtcTransport | undefined,
  producers: Map<string, Record<string, Producer>>
) {
  if (!transport) throw new Error("No producer transport");

  const appData: any = { socketId: socket.id };
  if (kind === "video") Object.assign(appData, { width: 1280, height: 720 });

  const producer = await transport.produce({ kind, rtpParameters, appData });
  producers.get(socket.id)![kind] = producer;

  addProducerToMix(producer);

 const cleanup = () => {
   removeProducerFromMix(producer.id);
  delete producers.get(socket.id)![kind];
};

// Cleanup if producer's transport closes
producer.on("transportclose", cleanup);

// Cleanup if producer itself is closed by any other means
producer.on("@close", cleanup);
  socket.broadcast.emit("newProducer", { socketId: socket.id, producerId: producer.id, kind });
  socket.broadcast.emit("newProducerAvailable");

  return producer;
}
