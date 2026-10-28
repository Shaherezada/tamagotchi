import { type JwtUser, OutboxService, TokenRevocationService } from '@app/common';
import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PasswordHasher } from '../users/password-hasher';
import { User } from '../users/user.entity';
import { AuthTokenDto } from './dto/auth-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtTokenService } from './jwt-token.service';

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
  register(_dto: RegisterDto): Promise<AuthTokenDto> {
    throw new NotImplementedException();
  }

  login(_dto: LoginDto): Promise<AuthTokenDto> {
    throw new NotImplementedException();
  }

  logout(_user: JwtUser): Promise<void> {
    throw new NotImplementedException();
  }
}
