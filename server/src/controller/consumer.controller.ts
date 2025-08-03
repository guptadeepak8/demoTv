import { Consumer, Producer, Router, WebRtcTransport } from 'mediasoup/node/lib/types';
import { Socket } from 'socket.io';

export async function handleConsume(
  router: Router,
  transport: WebRtcTransport | undefined,
  rtpCapabilities: any,
  producers: Map<string, Record<string, Producer>>,
  consumers: Map<string, Consumer[]>,
  socket: Socket
) {
  if (!transport) return { error: "No consumer transport" };

  const results = [];

  for (const [id, kindMap] of producers.entries()) {
    if (id === socket.id) continue;
    for (const kind in kindMap) {
      const producer = kindMap[kind];
      if (router.canConsume({ producerId: producer.id, rtpCapabilities })) {
        const consumer = await transport.consume({
          producerId: producer.id,
          rtpCapabilities,
          paused: true,
        });

        consumers.get(socket.id)!.push(consumer);

        consumer.on("transportclose", () => {
          consumer.close();
          consumers.set(socket.id, consumers.get(socket.id)!.filter(c => c.id !== consumer.id));
        });

        consumer.on("producerclose", () => {
          consumer.close();
          consumers.set(socket.id, consumers.get(socket.id)!.filter(c => c.id !== consumer.id));
          socket.emit("producerClosed", { producerId: producer.id });
        });

        results.push({
          producerId: producer.id,
          id: consumer.id,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          type: consumer.type,
        });
      }
    }
  }

  return results.length > 0 ? results : { error: "No compatible producers" };
}
