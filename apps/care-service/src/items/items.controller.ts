import { ApiProblems, BEARER_AUTH, ParseIdPipe, Public, Role, Roles } from '@app/common';
import { Body, Controller, Get, Param, Patch, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CARE_TAG } from '../swagger';
import { CreateItemDto } from './dto/create-item.dto';
import { IconDto } from './dto/icon.dto';
import { ItemDto } from './dto/item.dto';
import { ItemsQuery } from './dto/items-query.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ICON_FIELD, ICON_MAX_BYTES, IconFilePipe } from './icon-file.pipe';
import { ItemsService } from './items.service';

@ApiTags(CARE_TAG)
@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Каталог предметов', description: 'Активные предметы; ответ кэшируется в Redis на 5 минут' })
  @ApiOkResponse({ type: [ItemDto], description: 'Предметы каталога' })
  @ApiProblems(400)
  list(@Query() query: ItemsQuery): Promise<ItemDto[]> {
    return this.items.list(query);
  }

  @Public()
  @Get(':itemId')
  @ApiOperation({ summary: 'Предмет' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOkResponse({ type: ItemDto, description: 'Предмет' })
  @ApiProblems(404)
  get(@Param('itemId', ParseIdPipe) itemId: string): Promise<ItemDto> {
    return this.items.get(itemId);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({ summary: 'Новый предмет (админ)' })
  @ApiCreatedResponse({ type: ItemDto, description: 'Предмет создан' })
  @ApiProblems(400, 401, 403, [409, 'Код предмета занят'])
  create(@Body() dto: CreateItemDto): Promise<ItemDto> {
    return this.items.create(dto);
  }

  @Patch(':itemId')
  @Roles(Role.ADMIN)
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({ summary: 'Изменить или отключить предмет (админ)', description: 'isActive: false снимает с продажи' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiOkResponse({ type: ItemDto, description: 'Изменённый предмет' })
  @ApiProblems(400, 401, 403, 404)
  update(@Param('itemId', ParseIdPipe) itemId: string, @Body() dto: UpdateItemDto): Promise<ItemDto> {
    return this.items.update(itemId, dto);
  }

  @Put(':itemId/icon')
  @Roles(Role.ADMIN)
  @ApiBearerAuth(BEARER_AUTH)
  @UseInterceptors(FileInterceptor(ICON_FIELD, { limits: { fileSize: ICON_MAX_BYTES, files: 1 } }))
  @ApiOperation({ summary: 'Загрузить иконку предмета в Silo (админ)', description: 'PNG, JPEG или WebP до 512 КБ' })
  @ApiParam({ name: 'itemId', format: 'uuid' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [ICON_FIELD],
      properties: { [ICON_FIELD]: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: IconDto, description: 'Иконка загружена' })
  @ApiProblems(400, 401, 403, 404, [413, 'Файл больше 512 КБ'], [415, 'Не PNG, JPEG или WebP'])
  uploadIcon(
    @Param('itemId', ParseIdPipe) itemId: string,
    @UploadedFile(IconFilePipe) file: Express.Multer.File,
  ): Promise<IconDto> {
    return this.items.uploadIcon(itemId, file);
  }
}
