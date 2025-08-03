// import {Consumer,Producer,Router} from "mediasoup/node/lib/types"
 
// export async function pipeProducerToRouter(
//   producer: Producer,
//   sourceRouter: Router,
//   targetRouter: Router
// ): Promise<Consumer> {
//   if (sourceRouter.id === targetRouter.id) {
//     throw new Error('Source and target routers must be different for piping.');
//   }

//   // 1. Create PipeTransports
//   const [pipeTransportA, pipeTransportB] = await Promise.all([
//     sourceRouter.createPipeTransport({ listenIp: '127.0.0.1' }),
//     targetRouter.createPipeTransport({ listenIp: '127.0.0.1' }),
//   ]);

//   // 2. Connect them
//   await pipeTransportA.connect({ ip: '127.0.0.1', port: pipeTransportB.tuple.localPort });
//   await pipeTransportB.connect({ ip: '127.0.0.1', port: pipeTransportA.tuple.localPort });

//   // 3. Pipe the producer
//   const pipeConsumer = await pipeTransportA.consume({
//     producerId: producer.id,
//   });

//   const pipeProducer = await pipeTransportB.produce({
//     id: producer.id,
//     kind: pipeConsumer.kind,
//     rtpParameters: pipeConsumer.rtpParameters,
//   });

//   // Optional: resume
//   await pipeConsumer.resume();

//   return pipeProducer;
// }
