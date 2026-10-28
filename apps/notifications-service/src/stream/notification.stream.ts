import { Injectable, type MessageEvent } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import type { NotificationDto } from '../notifications/dto/notification.dto';

/** Живой поток уведомлений SSE: свой Subject на каждого подключённого игрока этого экземпляра. */
@Injectable()
export class NotificationStream {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  subscribe(userId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let subject = this.streams.get(userId);
      if (!subject) {
        subject = new Subject<MessageEvent>();
        this.streams.set(userId, subject);
      }
      const subscription = subject.subscribe(subscriber);
      return () => {
        subscription.unsubscribe();
        // последнее соединение игрока закрыто – Subject больше не нужен
        if (!subject.observed) {
          this.streams.delete(userId);
        }
      };
    });
  }

  push(userId: string, notification: NotificationDto): void {
    this.streams.get(userId)?.next({ type: 'notification', id: notification.id, data: notification });
  }
}
