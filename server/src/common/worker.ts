import os from "os";
import * as mediasoup from "mediasoup";
import {  Worker } from 'mediasoup/node/lib/types';
const cpuCores = os.cpus().length;
const workers: Worker[] = [];

export const createWorkers = async () => {
  for (let i = 0; i < cpuCores; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: "warn",
      logTags: ["ice", "dtls", "rtp", "srtp", "rtcp"],
    });

    worker.on("died", () => {
      console.error("❌ mediasoup worker died, exiting in 2s...");
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
  }
  return workers;
};
let nextWorker = 0;

export function getWorker() {
  const worker = workers[nextWorker];
  nextWorker = (nextWorker + 1) % workers.length;
  return worker;
}