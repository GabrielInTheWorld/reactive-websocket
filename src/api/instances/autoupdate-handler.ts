import { EventMessage } from './socket-message';
import { SocketConnection } from './socket-connection';

export class AutoupdateHandler {
  private socketMap: { [key: string]: SocketConnection[] } = {};

  public subscribe(event: string, socket: SocketConnection): void {
    const sockets = this.socketMap[event] || [];
    sockets.push(socket);
    this.socketMap[event] = sockets;
  }

  public unsubscribe(event: string, socket: SocketConnection): void {
    const sockets = this.socketMap[event];
    const index = sockets.findIndex(_socket => _socket.id === socket.id);
    if (index > -1) {
      sockets.splice(index, 1);
      this.socketMap[event] = sockets;
    }
  }

  public publish<T>(event: string, data: EventMessage<T>): void {
    for (const socket of this.socketMap[event]) {
      socket.send(data);
    }
  }
}
