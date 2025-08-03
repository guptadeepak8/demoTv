import { AppData, Worker } from "mediasoup/node/lib/types";

import * as mediasoup from 'mediasoup'


export const createMediaWorker = async (): Promise<Worker<AppData>> => {
  const newWorker = await mediasoup.createWorker()

  newWorker.on("died", (error) => {
    console.error("mediasoup worker has died")
    setTimeout(() => {
      process.exit();
    }, 2000);
  });

  return newWorker;
}