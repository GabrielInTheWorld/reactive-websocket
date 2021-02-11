import { Id } from './types';

export enum MessageType {
  TO = 'to',
  BROADCAST = 'broadcast',
  SERVER = 'server',
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe'
}

export interface EventMessage<T = object> {
  event: string;
  data: T;
}

export interface SocketMessage<T = EventMessage> {
  type: MessageType;
  message: T;
  to?: Id;
}
