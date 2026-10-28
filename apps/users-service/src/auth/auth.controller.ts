import { ApiProblems, BEARER_AUTH, CurrentUser, type JwtUser, Public } from '@app/common';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { USERS_TAG } from '../swagger';
import { AuthService } from './auth.service';
import { AuthTokenDto } from './dto/auth-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags(USERS_TAG)
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Регистрация',
    description: 'Создаёт игрока с ролью player и публикует user.registered: care выдаст 100 монет и стартовый набор',
  })
  @ApiCreatedResponse({ type: AuthTokenDto, description: 'Игрок создан, выдан токен' })
  @ApiProblems(400, [409, 'Логин занят'])
  register(@Body() dto: RegisterDto): Promise<AuthTokenDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Вход' })
  @ApiOkResponse({ type: AuthTokenDto, description: 'Выдан токен' })
  @ApiProblems(400, [401, 'Неверный логин или пароль'])
  login(@Body() dto: LoginDto): Promise<AuthTokenDto> {
    return this.auth.login(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({ summary: 'Выход', description: 'Токен отзывается до истечения срока во всех сервисах' })
  @ApiNoContentResponse({ description: 'Токен отозван' })
  @ApiProblems(401)
  logout(@CurrentUser() user: JwtUser): Promise<void> {
    return this.auth.logout(user);
  }
}
