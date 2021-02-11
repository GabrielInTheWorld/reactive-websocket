export enum MessageType {
  SERVER = "server",
  BROADCAST = "broadcast",
  TO = "to",
}

export type Message = object | string;

export interface WebsocketMessage<T = Message> {
  type: MessageType;
  message: T;
  to?: string;
}
export namespace Websocket {}
