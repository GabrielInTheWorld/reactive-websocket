import { Server } from 'http';
import { Observable } from 'rxjs';
import { connection as Connection, request as Request, server as WebsocketServer } from 'websocket';

import { Constructable } from '../core';
import { AutoupdateHandler } from './instances/autoupdate-handler';
import { SocketConfiguration, SocketConnection } from './instances/socket-connection';
import { EventMap } from './instances/event-map';
import { EventMessage, SocketMessage, MessageType } from './instances/socket-message';
import { SocketDto } from './instances/socket-dto';
import { Random } from '../core/util';

interface SocketAttributes {
  id: string;
}

/**
 *Configuration object for an instance of the websocket-handler.
 *
 * @export
 * @interface WebsocketConfiguration
 */
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
  onClientDisconnect?: (socket: SocketConnection) => void;
  /**
   * A Hook, every time a client sent a message.
   */
  onClientSend?: (message: SocketMessage, socket: SocketConnection) => void;
  /**
   * A logger to customize log information.
   */
  logger?: (...message: any[]) => void;
}

@Constructable(WebsocketHandler)
export class WebsocketHandler {
  private websocketServer: WebsocketServer;
  private sockets: Map<string, SocketConnection> = new Map();
  private autoupdateHandler: AutoupdateHandler;

  private _onWebsocketCreate: (event: Connection) => void;
  private _onWebsocketDestroy: (event: Connection) => void;
  private _onClientConnect: (socket: SocketConnection) => void;
  private _onClientDisconnect: (socket: SocketConnection) => void;
  private _onClientSend: (message: SocketMessage, socket: SocketConnection) => void;
  private _isOriginAllowed: (origin: string) => boolean;
  private _log: (...message: any[]) => void;

  private mapEvents = new EventMap();

  public initWebsocket(config: WebsocketConfiguration): void {
    this.websocketServer = new WebsocketServer({
      httpServer: config.httpServer,
      autoAcceptConnections: false
    });

    this._onWebsocketCreate = config.onWebsocketCreate || this.onConnect;
    this._onWebsocketDestroy = config.onWebsocketDestroy || this.onClose;
    this._isOriginAllowed = config.isOriginAllowed || this.isOriginAllowed;
    this._onClientConnect = config.onClientConnect || this.onClientConnect;
    this._onClientDisconnect = config.onClientDisconnect || this.onClientDisconnect;
    this._onClientSend = config.onClientSend || this.onClientSend;
    this._log = config.logger || console.log;
    this.autoupdateHandler = new AutoupdateHandler({ logger: this._log });

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
  private onClientDisconnect(_socket: SocketConnection): void {}
  private onClientSend(_message: SocketMessage, _socket: SocketConnection): void {}

  private onRequest(request: Request): void {
    this._log('received request from origin: ', request.origin);
    if (!this._isOriginAllowed(request.origin)) {
      request.reject();
      return;
    }
    const connection = request.accept('echo-protocol', request.origin);
    const id = Random.RandomString();

    this._log('client connected', id);
    const socket = this.createSocket({ id, connection });
    this._onClientConnect(socket);
    this.sockets.set(id, socket);
  }

  private createSocket(configuration: SocketConfiguration): SocketConnection {
    const socket = new SocketConnection(configuration);

    socket.onMessage(parsedMessage => {
      this._log('Parsed message:', parsedMessage);
      this.mapEvents.pushMessage<SocketDto>(parsedMessage.type, {
        data: parsedMessage.message,
        socketId: socket.id
      });
      this._log('Message from type: ', parsedMessage.type);
      switch (parsedMessage.type) {
        case MessageType.SUBSCRIBE:
          this.autoupdateHandler.subscribe(parsedMessage.message.event, socket);
          break;
        case MessageType.UNSUBSCRIBE:
          this.autoupdateHandler.unsubscribe(parsedMessage.message.event, socket);
          break;
        default:
          this._onClientSend(parsedMessage, socket);
      }
    });

    socket.onClose((_reason, _description) => {
      this.sockets.delete(socket.id);
      this._onClientDisconnect(socket);
    });

    return socket;
  }

  public broadcastExceptOne<T>(omittedSocket: string, message: EventMessage): Observable<T> {
    const observable = this.mapEvents.fromEvent<T>(message.event);
    this.sockets.forEach((_, key) => {
      if (key !== omittedSocket) {
        this.sendToSocket(key, message);
      }
    });
    return observable;
  }

  public broadcastAll<T>(message: EventMessage): Observable<T> {
    const observable = this.mapEvents.fromEvent<T>(message.event);
    this.sockets.forEach((_, key) => {
      this.sendToSocket(key, message);
    });
    return observable;
  }

  public broadcastByFunction(fn: (socketId: string) => EventMessage, omittedSocket: string): void {
    const sockets = Array.from(this.sockets.keys()).filter(socket => socket !== omittedSocket);
    for (const socket of sockets) {
      this.sendToSocket(socket, fn(socket));
    }
  }

  public emit<T>(socket: string, message: EventMessage): Observable<T> {
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

  public subscribe(event: string, socket: SocketConnection): void {
    this.autoupdateHandler.subscribe(event, socket);
  }
  public unsubscribe(event: string, socket: SocketConnection): void {
    this.autoupdateHandler.unsubscribe(event, socket);
  }
  public publish<T>(event: string, data: T): void {
    this.autoupdateHandler.publish(event, { event, data });
  }

  private sendToSocket(socket: string, message: EventMessage): void {
    this.sockets.get(socket)?.send(message);
  }

  private isOriginAllowed(_origin: string): boolean {
    return true;
  }
}
