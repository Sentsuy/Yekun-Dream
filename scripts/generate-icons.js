const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.resolve(__dirname, '../icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate valid RGBA PNG images programmatically for each required size
// Matches visual identity: dark rounded background with neon diamond (#e8ff47)
function createPng(size) {
  function crc32(buf) {
    let table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Raw Image Data (filter byte 0 at start of each scanline)
  const rowBytes = size * 4;
  const raw = Buffer.alloc(size * (rowBytes + 1));
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size / 2 - 0.5;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = Math.abs(x - cx + 0.5);
      const dy = Math.abs(y - cy + 0.5);
      const dist = Math.hypot(x - cx + 0.5, y - cy + 0.5);

      const diamondDist = dx + dy;

      if (dist <= rMax) {
        // Base dark circle #141418
        let r = 20, g = 20, b = 24, a = 255;

        // Proportional diamond markers
        const dOuter = size * 0.44;
        const dInner = size * 0.22;
        const dCore  = size * 0.08;

        if (diamondDist <= dOuter && diamondDist >= dInner) {
          // Neon Yellow #e8ff47
          r = 232; g = 255; b = 71; a = 255;
        } else if (diamondDist < dInner && diamondDist >= dCore) {
          // Accent core highlight
          r = 210; g = 235; b = 60; a = 255;
        } else if (diamondDist < dCore) {
          // Center core #0d0d10
          r = 13; g = 13; b = 16; a = 255;
        }

        raw[pxOffset] = r;
        raw[pxOffset + 1] = g;
        raw[pxOffset + 2] = b;
        raw[pxOffset + 3] = a;
      } else {
        // Transparent outside
        raw[pxOffset] = 0;
        raw[pxOffset + 1] = 0;
        raw[pxOffset + 2] = 0;
        raw[pxOffset + 3] = 0;
      }
    }
  }

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

[16, 32, 48, 128].forEach(size => {
  const buf = createPng(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
  console.log(`Generated icons/icon${size}.png (${buf.length} bytes)`);
});
