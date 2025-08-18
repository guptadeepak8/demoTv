import { AppData, Worker, WorkerSettings } from "mediasoup/node/lib/types";

import * as mediasoup from 'mediasoup'



export const createMediaWorker = async (): Promise<Worker<AppData>> => {
  const newWorker = await mediasoup.createWorker<WorkerSettings>({
      logLevel: 'warn',
     logTags: ['ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  })

  newWorker.on("died", (error) => {
    console.error("mediasoup worker has died")
    setTimeout(() => {
      process.exit();
    }, 2000);
  });

  return newWorker;
}