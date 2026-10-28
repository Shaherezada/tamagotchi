import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser, ParseIdPipe } from '@app/common';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  type MessageEvent,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Observable } from 'rxjs';
import { NotificationStream } from '../stream/notification.stream';
import { NOTIFICATIONS_TAG } from '../swagger';
import { NotificationPageDto } from './dto/notification-page.dto';
import { NotificationDto } from './dto/notification.dto';
import { NotificationsQuery } from './dto/notifications-query.dto';
import { SettingsDto } from './dto/settings.dto';
import { UnreadCountDto } from './dto/unread-count.dto';
import { NotificationsService } from './notifications.service';

@ApiTags(NOTIFICATIONS_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    // имя stream занято методом потока
    private readonly notificationStream: NotificationStream,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Мои уведомления', description: 'Курсорная пагинация: nextCursor передаётся в cursor' })
  @ApiOkResponse({ type: NotificationPageDto, description: 'Страница уведомлений' })
  @ApiProblems(400, 401)
  list(@CurrentUser() user: JwtUser, @Query() query: NotificationsQuery): Promise<NotificationPageDto> {
    return this.notifications.list(user.sub, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Число непрочитанных' })
  @ApiOkResponse({ type: UnreadCountDto, description: 'Счётчик' })
  @ApiProblems(401)
  unreadCount(@CurrentUser() user: JwtUser): Promise<UnreadCountDto> {
    return this.notifications.unreadCount(user.sub);
  }

  @Sse('stream')
  @ApiOperation({
    summary: 'Живой поток уведомлений (SSE)',
    description: 'Каждое новое уведомление приходит событием notification с NotificationDto в data',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'Поток text/event-stream',
    content: { 'text/event-stream': { schema: { type: 'string', example: 'event: notification\ndata: {…}\n\n' } } },
  })
  @ApiProblems(401)
  stream(@CurrentUser() user: JwtUser): Observable<MessageEvent> {
    return this.notificationStream.subscribe(user.sub);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Настройки уведомлений' })
  @ApiOkResponse({ type: SettingsDto, description: 'Какие уведомления присылать' })
  @ApiProblems(401)
  getSettings(@CurrentUser() user: JwtUser): Promise<SettingsDto> {
    return this.notifications.getSettings(user.sub);
  }

  @Put('settings')
  @ApiOperation({ summary: 'Изменить настройки уведомлений' })
  @ApiOkResponse({ type: SettingsDto, description: 'Сохранённые настройки' })
  @ApiProblems(400, 401)
  updateSettings(@CurrentUser() user: JwtUser, @Body() dto: SettingsDto): Promise<SettingsDto> {
    return this.notifications.updateSettings(user.sub, dto);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Прочитать все' })
  @ApiNoContentResponse({ description: 'Все уведомления отмечены прочитанными' })
  @ApiProblems(401)
  readAll(@CurrentUser() user: JwtUser): Promise<void> {
    return this.notifications.readAll(user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Отметить уведомление прочитанным' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NotificationDto, description: 'Уведомление' })
  @ApiProblems(400, 401, 404)
  markRead(@CurrentUser() user: JwtUser, @Param('id', ParseIdPipe) id: string): Promise<NotificationDto> {
    return this.notifications.markRead(user.sub, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить уведомление' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiNoContentResponse({ description: 'Удалено' })
  @ApiProblems(401, 404)
  remove(@CurrentUser() user: JwtUser, @Param('id', ParseIdPipe) id: string): Promise<void> {
    return this.notifications.remove(user.sub, id);
  }
}
