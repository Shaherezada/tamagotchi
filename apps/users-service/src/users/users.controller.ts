import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser } from '@app/common';
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { USERS_TAG } from '../swagger';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags(USERS_TAG)
@ApiBearerAuth(BEARER_AUTH)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Мой профиль' })
  @ApiOkResponse({ type: UserDto, description: 'Профиль игрока' })
  @ApiProblems(401)
  getMe(@CurrentUser() user: JwtUser): Promise<UserDto> {
    return this.users.getMe(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Сменить ник' })
  @ApiOkResponse({ type: UserDto, description: 'Профиль с новым ником' })
  @ApiProblems(400, 401)
  updateMe(@CurrentUser() user: JwtUser, @Body() dto: UpdateUserDto): Promise<UserDto> {
    return this.users.updateMe(user.sub, dto);
  }

  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Сменить пароль',
    description: 'Нужен текущий пароль; выданные токены продолжают действовать',
  })
  @ApiNoContentResponse({ description: 'Пароль изменён' })
  @ApiProblems(400, [401, 'Нет токена или текущий пароль неверен'])
  changePassword(@CurrentUser() user: JwtUser, @Body() dto: ChangePasswordDto): Promise<void> {
    return this.users.changePassword(user.sub, dto);
  }
}
