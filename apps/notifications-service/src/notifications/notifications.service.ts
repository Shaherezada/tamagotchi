import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import { NotificationStream } from '../stream/notification.stream';
import { NotificationPageDto } from './dto/notification-page.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationsQuery } from './dto/notifications-query.dto';
import { SettingsDto } from './dto/settings.dto';
import { UnreadCountDto } from './dto/unread-count.dto';
import type { NewNotification } from './new-notification';
import { NotificationSettings } from './notification-settings.entity';
import { Notification } from './notification.entity';

/** Уведомления игрока; чужое уведомление – 404. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationSettings) private readonly settings: Repository<NotificationSettings>,
    private readonly stream: NotificationStream,
  ) {}

  /** Курсорная пагинация по (created_at, id), новые первыми. */
  list(_userId: string, _query: NotificationsQuery): Promise<NotificationPageDto> {
    throw new NotImplementedException();
  }

  unreadCount(_userId: string): Promise<UnreadCountDto> {
    throw new NotImplementedException();
  }

  markRead(_userId: string, _id: string): Promise<NotificationDto> {
    throw new NotImplementedException();
  }

  readAll(_userId: string): Promise<void> {
    throw new NotImplementedException();
  }

  remove(_userId: string, _id: string): Promise<void> {
    throw new NotImplementedException();
  }

  getSettings(_userId: string): Promise<SettingsDto> {
    throw new NotImplementedException();
  }

  updateSettings(_userId: string, _dto: SettingsDto): Promise<SettingsDto> {
    throw new NotImplementedException();
  }

  /** Сохранение в транзакции inbox с учётом настроек игрока; в поток – после коммита. */
  notify(_manager: EntityManager, _notification: NewNotification): Promise<void> {
    throw new NotImplementedException();
  }
}
