import { deflateSync } from 'node:zlib';
import { Stage } from './pet-enums';
import { PET_FORMS } from './pet-forms.catalog';

type Rgb = [number, number, number];

const GRID = 32;
const SCALE = 4;

const BODY: Record<string, Rgb> = {
  egg: [250, 240, 205],
  baby: [255, 214, 102],
  good: [255, 170, 60],
  normal: [120, 190, 120],
  bad: [150, 110, 190],
  star: [255, 120, 140],
  elder: [190, 190, 200],
};
const INK: Rgb = [40, 40, 50];
const CHEEK: Rgb = [255, 130, 150];
const SPOT: Rgb = [140, 200, 230];
const GOLD: Rgb = [255, 215, 0];

/**
 * Пиксельная картинка формы питомца 128×128 PNG (§12, pet-forms/<код>.png): размер по стадии,
 * цвет и выражение – по качеству формы. Рисуется кодом, чтобы не хранить бинарные файлы.
 */
export function renderPetFormImage(code: string): Buffer {
  const form = PET_FORMS.find((f) => f.code === code);
  if (!form) {
    throw new Error(`Неизвестная форма питомца ${code}`);
  }
  const pixels: (Rgb | null)[] = new Array<Rgb | null>(GRID * GRID).fill(null);
  const set = (x: number, y: number, color: Rgb): void => {
    if (x >= 0 && x < GRID && y >= 0 && y < GRID) {
      pixels[y * GRID + x] = color;
    }
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: Rgb): void => {
    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) {
          set(x, y, color);
        }
      }
    }
  };

  if (form.stage === Stage.EGG) {
    ellipse(16, 17, 9, 12, INK);
    ellipse(16, 17, 8, 11, BODY.egg);
    ellipse(12, 13, 2, 2, SPOT);
    ellipse(20, 19, 2.5, 2.5, SPOT);
    ellipse(14, 23, 1.5, 1.5, SPOT);
    return encodePng(pixels);
  }

  const mood = code.split('_')[1] ?? (form.stage === Stage.ELDER ? 'elder' : 'baby');
  const radius = { [Stage.BABY]: 7, [Stage.CHILD]: 9, [Stage.TEEN]: 10, [Stage.ADULT]: 12, [Stage.ELDER]: 12 }[
    form.stage
  ];
  const cy = 30 - radius;
  const body = BODY[mood] ?? BODY.baby;
  if (form.stage === Stage.TEEN || form.stage === Stage.ADULT) {
    ellipse(16 - radius * 0.6, cy - radius * 0.8, 2.5, 3.5, INK);
    ellipse(16 + radius * 0.6, cy - radius * 0.8, 2.5, 3.5, INK);
  }
  ellipse(16, cy, radius + 1, radius + 1, INK);
  ellipse(16, cy, radius, radius, body);
  // глаза
  const eyeY = Math.round(cy - radius * 0.2);
  for (const ex of [Math.round(16 - radius * 0.4), Math.round(16 + radius * 0.4) - 1]) {
    set(ex, eyeY, INK);
    set(ex, eyeY + 1, INK);
    if (mood === 'bad') {
      set(ex + (ex < 16 ? -1 : 1), eyeY - 2, INK);
      set(ex, eyeY - 1, INK);
    }
  }
  // рот: улыбка, ровный, хмурый
  const mouthY = Math.round(cy + radius * 0.35);
  for (let dx = -2; dx <= 2; dx++) {
    const edge = Math.abs(dx) === 2;
    const dy = mood === 'normal' || mood === 'elder' ? 0 : mood === 'bad' ? (edge ? 1 : 0) : edge ? -1 : 0;
    set(16 + dx, mouthY + dy, INK);
  }
  if (mood === 'good' || mood === 'star' || mood === 'baby') {
    ellipse(16 - radius * 0.65, mouthY - 1, 1.5, 1, CHEEK);
    ellipse(16 + radius * 0.65, mouthY - 1, 1.5, 1, CHEEK);
  }
  if (mood === 'elder') {
    ellipse(16, mouthY + 4, 4, 3, [245, 245, 245]);
  }
  if (mood === 'star') {
    const top = cy - radius - 3;
    for (let i = -2; i <= 2; i++) {
      set(16 + i, top, GOLD);
      set(16, top + i, GOLD);
    }
    set(15, top - 1, GOLD);
    set(17, top + 1, GOLD);
    set(15, top + 1, GOLD);
    set(17, top - 1, GOLD);
  }
  return encodePng(pixels);
}

function encodePng(pixels: (Rgb | null)[]): Buffer {
  const size = GRID * SCALE;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const color = pixels[Math.floor(y / SCALE) * GRID + Math.floor(x / SCALE)];
      const offset = row + 1 + x * 4;
      if (color) {
        raw[offset] = color[0];
        raw[offset + 1] = color[1];
        raw[offset + 2] = color[2];
        raw[offset + 3] = 255;
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8 бит, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
