import { type JwtUser, OutboxService, ProblemException, TokenRevocationService } from '@app/common';
import { createEnvelope, RoutingKey, type UserRegistered } from '@app/contracts';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { PasswordHasher } from '../users/password-hasher';
import { User } from '../users/user.entity';
import { AuthTokenDto } from './dto/auth-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtTokenService } from './jwt-token.service';

// Хэш случайного пароля: при неизвестном логине проверка идёт против него, чтобы по времени ответа
// нельзя было узнать, есть ли такой логин
const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$tXHO2UEMB7G+j6JiRixOjQ$nT5l7PPy+YTFw1ADzz1YLC4o3VOEI3dfAgBdpYobBjQ';

const UNIQUE_VIOLATION = '23505';

function loginTaken(login: string): ProblemException {
  return ProblemException.conflict('login-taken', 'Логин занят', `Логин ${login} уже зарегистрирован`);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly outbox: OutboxService,
    private readonly dataSource: DataSource,
    private readonly tokens: JwtTokenService,
    private readonly revocation: TokenRevocationService,
    private readonly hasher: PasswordHasher,
  ) {}

  /** Пользователь и user.registered в outbox – одной транзакцией. */
  async register(dto: RegisterDto): Promise<AuthTokenDto> {
    if (await this.users.existsBy({ login: dto.login })) {
      throw loginTaken(dto.login);
    }
    const passwordHash = await this.hasher.hash(dto.password);
    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(User, { login: dto.login, nickname: dto.nickname, passwordHash }),
        );
        const payload: UserRegistered = {
          userId: created.id,
          login: created.login,
          nickname: created.nickname,
          registeredAt: created.createdAt.toISOString(),
        };
        await this.outbox.add(manager, createEnvelope(RoutingKey.UserRegistered, payload, created.createdAt));
        return created;
      });
    } catch (error) {
      // две одновременные регистрации одного логина: проверку выше прошли обе, UNIQUE пропустит одну
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
        throw loginTaken(dto.login);
      }
      throw error;
    }
    return this.tokens.issue(user);
  }

  async login(dto: LoginDto): Promise<AuthTokenDto> {
    const user = await this.users.findOneBy({ login: dto.login });
    const valid = await this.hasher.verify(user?.passwordHash ?? DUMMY_HASH, dto.password);
    if (!user || !valid) {
      throw new ProblemException({
        status: HttpStatus.UNAUTHORIZED,
        type: 'invalid-credentials',
        title: 'Неверный логин или пароль',
      });
    }
    return this.tokens.issue(user);
  }

  logout(user: JwtUser): Promise<void> {
    return this.revocation.revoke(user);
  }
}
