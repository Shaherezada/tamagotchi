import { Injectable, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserDto } from './dto/user.dto';
import { PasswordHasher } from './password-hasher';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly hasher: PasswordHasher,
  ) {}

  getMe(_userId: string): Promise<UserDto> {
    throw new NotImplementedException();
  }

  updateMe(_userId: string, _dto: UpdateUserDto): Promise<UserDto> {
    throw new NotImplementedException();
  }

  changePassword(_userId: string, _dto: ChangePasswordDto): Promise<void> {
    throw new NotImplementedException();
  }
}
