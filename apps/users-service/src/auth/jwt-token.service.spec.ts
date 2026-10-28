import { generateKeyPairSync } from 'node:crypto';
import { isJwtUser, Role } from '@app/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/user.entity';
import { JwtTokenService, TOKEN_TTL_SECONDS } from './jwt-token.service';

describe('JwtTokenService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  // те же signOptions, что в AuthModule
  const jwt = new JwtService({
    privateKey,
    publicKey,
    signOptions: { algorithm: 'RS256', expiresIn: TOKEN_TTL_SECONDS },
  });
  const user = Object.assign(new User(), { id: 'a1b2c3d4-0000-4000-8000-000000000001', role: Role.ADMIN });

  it('выпускает RS256-токен с sub, role, jti и exp через 60 минут', () => {
    const now = Math.floor(Date.now() / 1000);

    const dto = new JwtTokenService(jwt).issue(user);

    expect(dto.userId).toBe(user.id);
    expect(dto.expiresIn).toBe(3600);
    const payload = jwt.verify<object>(dto.accessToken, { algorithms: ['RS256'] });
    expect(isJwtUser(payload)).toBe(true);
    expect(payload).toMatchObject({ sub: user.id, role: Role.ADMIN, jti: expect.any(String) });
    const { exp } = payload as { exp: number };
    expect(exp - now).toBeGreaterThanOrEqual(3599);
    expect(exp - now).toBeLessThanOrEqual(3601);
  });

  it('у каждого токена свой jti – выход отзывает только его', () => {
    const service = new JwtTokenService(jwt);
    const first = jwt.decode<{ jti: string }>(service.issue(user).accessToken);
    const second = jwt.decode<{ jti: string }>(service.issue(user).accessToken);

    expect(first.jti).not.toBe(second.jti);
  });
});
