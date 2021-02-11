import { Server } from 'http';
import { Observable } from 'rxjs';
import { connection as Connection, request as Request, server as WebsocketServer } from 'websocket';

import { Constructable } from '../core';
import { SocketConfiguration, SocketConnection } from './instances/socket-connection';
import { EventMap } from './instances/event-map';
import { EventMessage } from './instances/socket-message';
import { SocketDto } from './instances/socket-dto';
import { MessageType } from './websocket-components';
import { Random } from '../core/util';

interface SocketAttributes {
  id: string;
}

export interface WebsocketConfiguration {
  /**
   * The http server
   */
  httpServer: Server;
  /**
   * Function to check, if an origin is allowed to connect to the websocket.
   */
  isOriginAllowed?: (origin: string) => boolean;
  /**
   * A Hook, when a websocket is created.
   */
  onWebsocketCreate?: (event: Connection) => void;
  /**
   * A Hook, when a websocket is destroyed.
   */
  onWebsocketDestroy?: (event: Connection) => void;
  /**
   * A Hook, every time a new client connected to a websocket.
   */
  onClientConnect?: (socket: SocketConnection) => void;
  /**
   * A Hook, every time a client disconnected from websocket.
   */
  onClientDisconnected?: (socket: SocketConnection) => void;
}

@Constructable(WebsocketHandler)
export class WebsocketHandler {
  private websocketServer: WebsocketServer;
  private sockets: Map<string, SocketConnection> = new Map();

  private _onWebsocketCreate: (event: Connection) => void;
  private _onWebsocketDestroy: (event: Connection) => void;
  private _onClientConnect: (socket: SocketConnection) => void;
  private _onClientDisconnected: (socket: SocketConnection) => void;
  private _isOriginAllowed: (origin: string) => boolean;

  private mapEvents = new EventMap();

  public initWebsocket(config: WebsocketConfiguration): void {
    this.websocketServer = new WebsocketServer({
      httpServer: config.httpServer
    });

    this._onWebsocketCreate = config.onWebsocketCreate || this.onConnect;
    this._onWebsocketDestroy = config.onWebsocketDestroy || this.onClose;
    this._isOriginAllowed = config.isOriginAllowed || this.isOriginAllowed;
    this._onClientConnect = config.onClientConnect || this.onClientConnect;
    this._onClientDisconnected = config.onClientDisconnected || this.onClientDisconnected;

    this.initWebsocketEvents();
  }

  private initWebsocketEvents(): void {
    this.websocketServer.on('connect', event => this._onWebsocketCreate(event));
    this.websocketServer.on('close', event => this._onWebsocketDestroy(event));
    this.websocketServer.on('request', request => this.onRequest(request));
  }

  private onConnect(_event: Connection): void {}
  private onClose(_event: Connection): void {}
  private onClientConnect(_socket: SocketConnection): void {}
  private onClientDisconnected(_socket: SocketConnection): void {}

  private onRequest(request: Request): void {
    console.log('received request from origin: ', request.origin);
    if (!this._isOriginAllowed(request.origin)) {
      request.reject();
      return;
    }
    const connection = request.accept('echo-protocol', request.origin);
    const id = Random.RandomString();

    console.log('client connected', id);
    const socket = this.createSocket({ id, connection });
    this._onClientConnect(socket);
    this.sockets.set(id, socket);
  }

  private createSocket(configuration: SocketConfiguration): SocketConnection {
    const socket = new SocketConnection(configuration);

    socket.onMessage(parsedMessage => {
      console.log('Parsed message:', parsedMessage);
      this.mapEvents.pushMessage<SocketDto>(parsedMessage.type, {
        data: parsedMessage.message,
        socketId: socket.id
      });
      console.log('Message from type: ', parsedMessage.type);
      switch (parsedMessage.type) {
        case MessageType.BROADCAST:
          this.broadcastExceptOne(socket.id, parsedMessage.message as EventMessage);
          break;
        case MessageType.TO:
          this.emit(parsedMessage.to as string, parsedMessage.message as EventMessage);
          break;
      }
    });

    socket.onClose((_reason, _description) => {
      this.sockets.delete(socket.id);
      this._onClientDisconnected(socket);
    });

    return socket;
  }

  public broadcastExceptOne<M, T>(omittedSocket: string, message: EventMessage<M>): Observable<T> {
    const observable = this.mapEvents.fromEvent<T>(message.event);
    this.sockets.forEach((_, key) => {
      if (key !== omittedSocket) {
        this.sendToSocket(key, message);
      }
    });
    return observable;
  }

  public broadcastAll<M, T>(message: EventMessage<M>): Observable<T> {
    const observable = this.mapEvents.fromEvent<T>(message.event);
    this.sockets.forEach((_, key) => {
      this.sendToSocket(key, message);
    });
    return observable;
  }

  public broadcastByFunction(fn: <M>(socketId: string) => EventMessage<M>, omittedSocket: string): void {
    const sockets = Array.from(this.sockets.keys()).filter(socket => socket !== omittedSocket);
    for (const socket of sockets) {
      this.sendToSocket(socket, fn(socket));
    }
  }

  public emit<M, T>(socket: string, message: EventMessage<M>): Observable<T> {
    const observable = this.mapEvents.fromEvent<T>(message.event);
    this.sendToSocket(socket, message);
    return observable;
  }

  public fromEvent<T>(eventName: string): Observable<T> {
    return this.mapEvents.fromEvent<T>(eventName);
  }

  public getSockets(): SocketAttributes[] {
    return Array.from(this.sockets.values()).map(socket => ({
      id: socket.id
    }));
  }

  public subscribe(): void {}
  public unsubscribe(): void {}
  public publish<T>(event: string, data: T): void {
    this.mapEvents.pushMessage(event, data);
  }

  private sendToSocket<M>(socket: string, message: EventMessage<M>): void {
    this.sockets.get(socket)?.send(message);
  }

  private isOriginAllowed(_origin: string): boolean {
    return true;
  }
}
