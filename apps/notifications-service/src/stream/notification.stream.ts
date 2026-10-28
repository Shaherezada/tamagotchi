import { Injectable, type MessageEvent, NotImplementedException } from '@nestjs/common';
import type { Observable, Subject } from 'rxjs';
import type { NotificationDto } from '../notifications/dto/notification.dto';

/** Живой поток уведомлений SSE: свой Subject на каждого подключённого игрока этого экземпляра. */
@Injectable()
export class NotificationStream {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  subscribe(_userId: string): Observable<MessageEvent> {
    throw new NotImplementedException();
  }

  push(_userId: string, _notification: NotificationDto): void {
    throw new NotImplementedException();
  }
}
