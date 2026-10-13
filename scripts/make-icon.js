// Generates resources/icon.png (512px) and resources/icon.ico (16-256px) for
// the packaged app, drawing the Expense Tracker logo: two rounded bars, one
// blue and one navy, the second offset right and down. Geometry and colours
// are taken from resources/logo.png (the original artwork).
//
// No image dependencies: shapes are rasterised with 4x4 supersampling and
// written as PNG via zlib.
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const BLUE  = [37, 99, 235];    // #2563EB
const NAVY  = [10, 26, 61];     // #0A1A3D
const PLATE = [255, 255, 255];  // white tile, so navy stays visible on dark taskbars

// Logo proportions, measured from the source artwork (bars 54x420,
// second bar offset +186x +60 within a 240x480 box):
const MARK_H  = 0.70;            // mark height as a fraction of the icon
const MARK_W  = MARK_H / 2;      // the artwork's box is exactly 2:1 tall
const MARK_X  = (1 - MARK_W) / 2;
const MARK_Y  = (1 - MARK_H) / 2;
const BAR_W   = 0.225 * MARK_W;  // 54/240
const BAR_H   = 0.875 * MARK_H;  // 420/480
const BAR2_DX = 0.775 * MARK_W;  // 186/240
const BAR2_DY = 0.125 * MARK_H;  // 60/480

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * The bars are thin by design. Below ~48px their true width lands under two
 * pixels and they fade to grey, so widen them just enough to stay solid —
 * keeping each bar centred where the artwork puts it.
 */
function bars(size) {
  const w  = Math.max(BAR_W, 2.1 / size);
  const c1 = MARK_X + BAR_W / 2;
  const c2 = MARK_X + BAR2_DX + BAR_W / 2;
  return [
    { cx: c1, y0: MARK_Y,           w, color: BLUE },
    { cx: c2, y0: MARK_Y + BAR2_DY, w, color: NAVY },
  ];
}

function sample(x, y, barList) {
  for (const b of barList) {
    if (inRoundRect(x, y, b.cx - b.w / 2, b.y0, b.cx + b.w / 2, b.y0 + BAR_H, b.w / 2)) return b.color;
  }
  if (inRoundRect(x, y, 0.02, 0.02, 0.98, 0.98, 0.18)) return PLATE;
  return null;
}

function render(size) {
  const SS      = 4;
  const barList = bars(size);
  const buf     = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = sample((px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, barList);
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
        }
      }
      const o = (py * size + px) * 4;
      if (a) {
        buf[o] = r / a; buf[o + 1] = g / a; buf[o + 2] = b / a;
        buf[o + 3] = Math.round((a / (SS * SS)) * 255);
      }
    }
  }
  return buf;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td  = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size) {
  const rgba = render(size);
  const raw  = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ico(sizes) {
  const images = sizes.map(png);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length;
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16);
    e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s;
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(images[i].length, 8); e.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images]);
}

const outDir = path.join(__dirname, '..', 'resources');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon.png'), png(512));
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]));
console.log('Wrote resources/icon.png and resources/icon.ico');
