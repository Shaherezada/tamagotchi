import type { MessageEvent } from '@nestjs/common';
import type { NotificationDto } from '../notifications/dto/notification.dto';
import { NotificationType } from '../notifications/notification-type.enum';
import { NotificationStream } from './notification.stream';

const dto: NotificationDto = {
  id: '33333333-3333-4333-8333-333333333333',
  type: NotificationType.PET_HUNGRY,
  title: 'Питомец голоден',
  body: '…',
  petId: null,
  isRead: false,
  createdAt: new Date('2026-11-05T10:15:00Z'),
};

describe('NotificationStream', () => {
  it('отдаёт уведомление всем соединениям игрока и только им', () => {
    const stream = new NotificationStream();
    const masha: MessageEvent[] = [];
    const mashaPhone: MessageEvent[] = [];
    const petya: MessageEvent[] = [];
    stream.subscribe('masha').subscribe((e) => masha.push(e));
    stream.subscribe('masha').subscribe((e) => mashaPhone.push(e));
    stream.subscribe('petya').subscribe((e) => petya.push(e));

    stream.push('masha', dto);

    expect(masha).toEqual([{ type: 'notification', id: dto.id, data: dto }]);
    expect(mashaPhone).toHaveLength(1);
    expect(petya).toHaveLength(0);
  });

  it('push без подключённых соединений ничего не делает', () => {
    expect(() => new NotificationStream().push('masha', dto)).not.toThrow();
  });

  it('после закрытия последнего соединения Subject игрока удаляется', () => {
    const stream = new NotificationStream();
    const first = stream.subscribe('masha').subscribe();
    const second = stream.subscribe('masha').subscribe();
    const streams = (stream as unknown as { streams: Map<string, unknown> }).streams;

    first.unsubscribe();
    expect(streams.has('masha')).toBe(true);
    second.unsubscribe();
    expect(streams.has('masha')).toBe(false);
  });
});
