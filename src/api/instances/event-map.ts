import { BehaviorSubject, Observable } from "rxjs";

export interface Event {
  event: string;
  content: any;
}

export class EventMap {
  private map: Map<string, BehaviorSubject<any>> = new Map();

  public pushMessage<T>(eventName: string, data: T): Observable<T> {
    const observable = this.getSubject<T>(eventName);
    observable.next(data);
    return observable.asObservable();
  }

  public fromEvent<T>(eventName: string): Observable<T> {
    return this.getSubject<T>(eventName).asObservable();
  }

  private getSubject<T>(eventName: string): BehaviorSubject<T> {
    let observable = this.map.get(eventName);
    if (!observable) {
      observable = new BehaviorSubject(null);
      this.map.set(eventName, observable);
    }
    return observable;
  }
}
