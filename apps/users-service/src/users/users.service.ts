import { ProblemException } from '@app/common';
import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { PasswordHasher } from './password-hasher';
import { User } from './user.entity';

export function toUserDto(user: User): UserDto {
  return { id: user.id, login: user.login, nickname: user.nickname, role: user.role, createdAt: user.createdAt };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly hasher: PasswordHasher,
  ) {}

  async getMe(userId: string): Promise<UserDto> {
    return toUserDto(await this.findOrFail(userId));
  }

  async updateMe(userId: string, dto: UpdateUserDto): Promise<UserDto> {
    const user = await this.findOrFail(userId);
    user.nickname = dto.nickname;
    return toUserDto(await this.users.save(user));
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findOrFail(userId);
    if (!(await this.hasher.verify(user.passwordHash, dto.currentPassword))) {
      throw new ProblemException({
        status: HttpStatus.UNAUTHORIZED,
        type: 'invalid-password',
        title: 'Текущий пароль неверен',
        detail: 'Пароль не изменён: текущий пароль указан неверно',
      });
    }
    user.passwordHash = await this.hasher.hash(dto.newPassword);
    await this.users.save(user);
  }

  // Токен подписан, а пользователя нет (удалён из БД) – токен больше ничего не значит: 401, как в §10
  private async findOrFail(userId: string): Promise<User> {
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      throw ProblemException.unauthorized('Пользователь из токена не найден');
    }
    return user;
  }
}
