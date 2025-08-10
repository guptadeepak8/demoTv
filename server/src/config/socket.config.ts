import { Server, Namespace } from "socket.io";


export function initializeSocketServer(io: Server) {
  
  const stream = io.of("/stream");
  const watch = io.of("/watch");

  return {stream ,watch}
  
}