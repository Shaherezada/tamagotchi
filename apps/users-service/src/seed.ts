import { Role, runSeedCli } from '@app/common';
import { hash } from 'argon2';
import { IsString, Length, Matches } from 'class-validator';
import { USERS_SCHEMA } from './database';
import { LOGIN_PATTERN, PASSWORD_PATTERN } from './users/dto/validation';
import { User } from './users/user.entity';
import { USERS_ENV_PREFIX, UsersEnv } from './users-env';

class SeedEnv extends UsersEnv {
  @Matches(LOGIN_PATTERN, { message: 'ADMIN_LOGIN: 3–32 символа, латинские буквы, цифры и _' })
  ADMIN_LOGIN: string;

  @Matches(PASSWORD_PATTERN, { message: 'ADMIN_PASSWORD: 8–64 символа, хотя бы одна буква и одна цифра' })
  ADMIN_PASSWORD: string;

  @IsString()
  @Length(1, 32)
  ADMIN_NICKNAME: string = 'Администратор';
}

/** Сид users_db: администратор из ADMIN_LOGIN и ADMIN_PASSWORD; если логин уже есть – ничего не меняет. */
runSeedCli(SeedEnv, USERS_ENV_PREFIX, USERS_SCHEMA, async (dataSource, env, logger) => {
  const users = dataSource.getRepository(User);
  if (await users.existsBy({ login: env.ADMIN_LOGIN })) {
    logger.log(`Администратор ${env.ADMIN_LOGIN} уже есть`);
    return;
  }
  await users.insert({
    login: env.ADMIN_LOGIN,
    nickname: env.ADMIN_NICKNAME,
    passwordHash: await hash(env.ADMIN_PASSWORD),
    role: Role.ADMIN,
  });
  logger.log(`Создан администратор ${env.ADMIN_LOGIN}`);
});
