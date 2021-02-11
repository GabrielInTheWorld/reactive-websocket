import { Id } from "./types";

export interface SocketDto<T = any> {
  socketId: Id;
  data: T;
}
