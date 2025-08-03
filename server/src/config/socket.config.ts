import { Server, Namespace } from "socket.io";


export function initializeSocketServer(io: Server) {
  /**
   * Namespace under which all mediasoup related socket events and data will be handled.
   * This helps in organizing socket events, making the codebase scalable and manageable.
   */
  const peers = io.of("/stream");
  const watch = io.of("/watch");

  return {peers ,watch}
  
}