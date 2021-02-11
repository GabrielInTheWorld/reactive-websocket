import { connection as Connection, IMessage } from 'websocket';

import { EventMessage, SocketMessage } from './socket-message';

export interface SocketConfiguration {
  id: string;
  connection: Connection;
}

type CloseHandler = (reason: number, description: string) => void;
type MessageHandler = (message: SocketMessage) => void;

export class SocketConnection {
  private readonly connection: Connection;
  private readonly _id: string;

  private closeHandler: CloseHandler;
  private messageHandler: MessageHandler;

  public get id(): string {
    return this._id;
  }

  public constructor(configuration: SocketConfiguration) {
    this.connection = configuration.connection;
    this._id = configuration.id;
    this.init();
  }

  public send<T>(message: EventMessage<T>): void {
    const rawMessage = JSON.stringify(message);
    this.connection.send(rawMessage);
  }

  public onMessage(messageHandler: MessageHandler): void {
    this.messageHandler = messageHandler;
  }

  public onClose(closeHandler: CloseHandler): void {
    this.closeHandler = closeHandler;
  }

  private init(): void {
    this.connection.on('message', rawMessage => {
      if (this.messageHandler) {
        this.messageHandler(this.parseMessage(rawMessage));
      }
    });
    this.connection.on('close', (reason, description) => {
      if (this.closeHandler) {
        this.closeHandler(reason, description);
      }
    });
  }

  private parseMessage(rawMessage: IMessage): SocketMessage {
    if (rawMessage.type === 'utf8' && rawMessage.utf8Data) {
      try {
        return JSON.parse(rawMessage.utf8Data);
      } catch (e) {
        console.error(e);
      }
    }
    console.debug('Message has a binary type: ', rawMessage.type, rawMessage.binaryData);
    return rawMessage as any;
  }
}
