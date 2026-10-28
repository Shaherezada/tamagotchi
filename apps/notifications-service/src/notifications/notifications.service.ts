import { ProblemException } from '@app/common';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, QueryRunner } from 'typeorm';
import { DataSource, Repository } from 'typeorm';
import { NotificationStream } from '../stream/notification.stream';
import { NotificationPageDto } from './dto/notification-page.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationsQuery } from './dto/notifications-query.dto';
import { SettingsDto } from './dto/settings.dto';
import { UnreadCountDto } from './dto/unread-count.dto';
import type { NewNotification } from './new-notification';
import { NotificationSettings } from './notification-settings.entity';
import { NotificationType } from './notification-type.enum';
import { Notification } from './notification.entity';

/** Какой флаг настроек отключает тип уведомления; приветствие не отключается. */
const SETTING_BY_TYPE: Partial<Record<NotificationType, keyof SettingsDto>> = {
  [NotificationType.PET_HUNGRY]: 'petHungry',
  [NotificationType.PET_SICK]: 'petSick',
  [NotificationType.PET_EVOLVED]: 'petEvolved',
  [NotificationType.PET_DIED]: 'petDied',
};

const DEFAULT_SETTINGS: SettingsDto = { petHungry: true, petSick: true, petEvolved: true, petDied: true };

/** Ключ в queryRunner.data: уведомления транзакции, которые уйдут в поток после коммита. */
const PENDING_STREAM = 'notifications:pending-stream';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// created_at с микросекундами: в Date они бы потерялись, и курсор повторил бы запись на границе страниц
const CURSOR_AT_SQL = `to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

interface PendingPush {
  userId: string;
  dto: NotificationDto;
}

interface Cursor {
  at: string;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.at}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(value: string): Cursor {
  const [at, id, ...rest] = Buffer.from(value, 'base64url').toString('utf8').split('|');
  if (rest.length > 0 || !id || !UUID.test(id) || Number.isNaN(Date.parse(at))) {
    throw ProblemException.badRequest(
      'Неверный курсор',
      'cursor должен быть значением nextCursor из предыдущей страницы',
      'invalid-cursor',
    );
  }
  return { at, id };
}

export function toNotificationDto(n: Notification): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    petId: n.petId,
    isRead: n.isRead,
    createdAt: n.createdAt,
  };
}

function toSettingsDto(s: NotificationSettings | null): SettingsDto {
  if (!s) {
    return { ...DEFAULT_SETTINGS };
  }
  return { petHungry: s.petHungry, petSick: s.petSick, petEvolved: s.petEvolved, petDied: s.petDied };
}

/** Уведомления игрока; чужое уведомление – 404. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationSettings) private readonly settings: Repository<NotificationSettings>,
    private readonly stream: NotificationStream,
    @InjectDataSource() dataSource: DataSource,
  ) {
    // в поток – только то, что действительно сохранено: после коммита транзакции inbox
    dataSource.subscribers.push({
      afterTransactionCommit: ({ queryRunner }) => this.flushStream(queryRunner),
      afterTransactionRollback: ({ queryRunner }) => {
        delete queryRunner.data[PENDING_STREAM];
      },
    });
  }

  /** Курсорная пагинация по (created_at, id), новые первыми. */
  async list(userId: string, query: NotificationsQuery): Promise<NotificationPageDto> {
    const qb = this.notifications
      .createQueryBuilder('n')
      .addSelect(CURSOR_AT_SQL, 'cursor_at')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .limit(query.limit + 1);
    if (query.unreadOnly) {
      qb.andWhere('n.is_read = false');
    }
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      qb.andWhere('(n.created_at, n.id) < (CAST(:at AS timestamptz), CAST(:id AS uuid))', cursor);
    }
    const { entities, raw } = await qb.getRawAndEntities<{ n_id: string; cursor_at: string }>();
    const items = entities.slice(0, query.limit);
    let nextCursor: string | null = null;
    if (entities.length > query.limit) {
      const last = items[items.length - 1];
      const at = raw.find((row) => row.n_id === last.id)!.cursor_at;
      nextCursor = encodeCursor({ at, id: last.id });
    }
    return { items: items.map(toNotificationDto), nextCursor };
  }

  async unreadCount(userId: string): Promise<UnreadCountDto> {
    return { count: await this.notifications.countBy({ userId, isRead: false }) };
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const notification = await this.notifications.findOneBy({ id, userId });
    if (!notification) {
      throw this.notFound(id);
    }
    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notifications.update({ id, userId }, { isRead: true, readAt: notification.readAt });
    }
    return toNotificationDto(notification);
  }

  async readAll(userId: string): Promise<void> {
    await this.notifications.update({ userId, isRead: false }, { isRead: true, readAt: () => 'now()' });
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.notifications.delete({ id, userId });
    if (!result.affected) {
      throw this.notFound(id);
    }
  }

  async getSettings(userId: string): Promise<SettingsDto> {
    return toSettingsDto(await this.settings.findOneBy({ userId }));
  }

  async updateSettings(userId: string, dto: SettingsDto): Promise<SettingsDto> {
    const saved = await this.settings.save(this.settings.create({ userId, ...dto }));
    return toSettingsDto(saved);
  }

  /** Сохранение в транзакции inbox с учётом настроек игрока; в поток – после коммита. */
  async notify(manager: EntityManager, notification: NewNotification): Promise<void> {
    const setting = SETTING_BY_TYPE[notification.type];
    if (setting) {
      const settings = toSettingsDto(await manager.findOneBy(NotificationSettings, { userId: notification.userId }));
      if (!settings[setting]) {
        return;
      }
    }
    const saved = await manager.save(
      manager.create(Notification, { ...notification, petId: notification.petId ?? null }),
    );
    const dto = toNotificationDto(saved);
    const queryRunner = manager.queryRunner;
    if (queryRunner?.isTransactionActive) {
      const pending = (queryRunner.data[PENDING_STREAM] ??= []) as PendingPush[];
      pending.push({ userId: notification.userId, dto });
    } else {
      this.stream.push(notification.userId, dto);
    }
  }

  private flushStream(queryRunner: QueryRunner): void {
    const pending = queryRunner.data[PENDING_STREAM] as PendingPush[] | undefined;
    delete queryRunner.data[PENDING_STREAM];
    pending?.forEach(({ userId, dto }) => this.stream.push(userId, dto));
  }

  private notFound(id: string): ProblemException {
    return ProblemException.notFound('Уведомление не найдено', `Уведомления ${id} нет`, 'notification-not-found');
  }
}
