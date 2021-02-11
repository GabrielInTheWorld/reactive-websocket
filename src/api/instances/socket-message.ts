import { Id } from './types';

export enum MessageType {
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe'
}

export interface EventMessage {
  [key: string]: any;
}

export interface SocketMessage<T = EventMessage> {
  type: MessageType | string;
  message: T;
  to?: Id;
}
