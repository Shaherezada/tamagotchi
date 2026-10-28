import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { PasswordHasher } from './password-hasher';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, { provide: PasswordHasher, useClass: Argon2PasswordHasher }],
  exports: [TypeOrmModule, PasswordHasher],
})
export class UsersModule {}
