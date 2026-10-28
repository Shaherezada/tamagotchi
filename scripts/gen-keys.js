/**
 * Пара ключей RS256 для JWT (§11) в secrets/ – папка в .gitignore, в репозиторий не попадает.
 * Работает везде, где есть Node.js (openssl не нужен). Уже созданные ключи не перезаписывает.
 *
 *   npm run keys
 */
const { generateKeyPairSync } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.resolve(__dirname, '..', 'secrets');
const privateFile = path.join(dir, 'jwt-private.pem');
const publicFile = path.join(dir, 'jwt-public.pem');

if (fs.existsSync(privateFile) && fs.existsSync(publicFile)) {
  console.log('Ключи уже есть: secrets/jwt-private.pem, secrets/jwt-public.pem');
  process.exit(0);
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

fs.mkdirSync(dir, { recursive: true });
// 0644: контейнеры работают от пользователя node и читают ключи через bind mount
fs.writeFileSync(privateFile, privateKey, { mode: 0o644 });
fs.writeFileSync(publicFile, publicKey, { mode: 0o644 });
console.log('Созданы secrets/jwt-private.pem и secrets/jwt-public.pem');
