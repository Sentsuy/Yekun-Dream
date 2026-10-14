const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.resolve(__dirname, '../icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const THEMES = {
  dark: {
    bg: [15, 18, 24, 255],
    border: [32, 41, 56, 255],
    accent: [56, 189, 248, 255],      // Sky Blue #38bdf8
    accentAlt: [14, 165, 233, 255],   // Deep Sky #0ea5e9
    pageFill: [30, 41, 59, 255],      // #1e293b
    starCore: [255, 255, 255, 255],
    hex: {
      bg: '#0f1218',
      border: '#202938',
      accent: '#38bdf8',
      accentAlt: '#0ea5e9',
      pageFill: '#1e293b'
    }
  },
  light: {
    bg: [248, 250, 252, 255],
    border: [203, 213, 225, 255],
    accent: [37, 99, 235, 255],       // Royal Blue #2563eb
    accentAlt: [29, 78, 216, 255],    // Deep Blue #1d4ed8
    pageFill: [226, 232, 240, 255],   // #e2e8f0
    starCore: [30, 58, 138, 255],
    hex: {
      bg: '#f8fafc',
      border: '#cbd5e1',
      accent: '#2563eb',
      accentAlt: '#1d4ed8',
      pageFill: '#e2e8f0'
    }
  },
  pink: {
    bg: [28, 18, 26, 255],
    border: [72, 41, 63, 255],
    accent: [244, 114, 182, 255],     // Sakura Pink #f472b6
    accentAlt: [236, 72, 153, 255],   // Rose #ec4899
    pageFill: [52, 25, 43, 255],      // #34192b
    starCore: [255, 255, 255, 255],
    hex: {
      bg: '#1c121a',
      border: '#48293f',
      accent: '#f472b6',
      accentAlt: '#ec4899',
      pageFill: '#34192b'
    }
  },
  neon: {
    bg: [5, 7, 15, 255],              // #05070f Deep Cyber Void
    border: [0, 240, 255, 255],        // #00f0ff Cyber Neon Cyan
    accent: [0, 240, 255, 255],        // #00f0ff
    accentAlt: [255, 0, 127, 255],     // #ff007f Electric Magenta
    pageFill: [12, 16, 34, 255],       // #0c1022
    starCore: [255, 255, 255, 255],
    hex: {
      bg: '#05070f',
      border: '#00f0ff',
      accent: '#00f0ff',
      accentAlt: '#ff007f',
      starCore: '#ffffff',
      pageFill: '#0c1022'
    }
  }
};

// ── SVG Master Generator ──────────────────────────────────────────
function generateSvg(themeKey) {
  const t = THEMES[themeKey];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="100%" height="100%">
  <defs>
    <radialGradient id="glow-${themeKey}" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="${t.hex.accent}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${t.hex.bg}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softGlow-${themeKey}" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Squircle Base Tile -->
  <rect width="128" height="128" rx="28" fill="${t.hex.bg}" stroke="${t.hex.border}" stroke-width="3"/>
  <rect width="128" height="128" rx="28" fill="url(#glow-${themeKey})"/>

  <!-- Dream Star (Celestial Crest) -->
  <path d="M64 16 L68 28 L80 32 L68 36 L64 48 L60 36 L48 32 L60 28 Z"
        fill="${t.hex.accent}" filter="url(#softGlow-${themeKey})"/>
  <circle cx="64" cy="32" r="2.5" fill="#ffffff"/>

  <!-- Open Manga Pages -->
  <!-- Left Page -->
  <path d="M63 48 C48 42 32 44 24 50 L24 96 C32 90 48 88 63 94 Z"
        fill="${t.hex.pageFill}" stroke="${t.hex.accent}" stroke-width="3" stroke-linejoin="round"/>
  <!-- Right Page -->
  <path d="M65 48 C80 42 96 44 104 50 L104 96 C96 90 80 88 65 94 Z"
        fill="${t.hex.pageFill}" stroke="${t.hex.accent}" stroke-width="3" stroke-linejoin="round"/>

  <!-- Page Lines / Reading Ribbons -->
  <path d="M32 62 C40 58 48 58 55 61" stroke="${t.hex.accentAlt}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <path d="M32 72 C40 68 48 68 55 71" stroke="${t.hex.accentAlt}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <path d="M32 82 C40 78 48 78 55 81" stroke="${t.hex.accentAlt}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>

  <path d="M73 61 C80 58 88 58 96 62" stroke="${t.hex.accentAlt}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <path d="M73 71 C80 68 88 68 96 72" stroke="${t.hex.accentAlt}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <path d="M73 81 C80 78 88 78 96 82" stroke="${t.hex.accentAlt}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>

  <!-- Central Spine / Bookmark -->
  <line x1="64" y1="46" x2="64" y2="98" stroke="${t.hex.accent}" stroke-width="4" stroke-linecap="round"/>
  <circle cx="64" cy="98" r="3" fill="${t.hex.accent}"/>
</svg>
`;
}

// ── Programmatic PNG Generator ────────────────────────────────────
function createThemePng(size, themeKey) {
  const theme = THEMES[themeKey];

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

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = size * 4;
  const raw = Buffer.alloc(size * (rowBytes + 1));

  // Geometry Evaluator at normalized (u, v) in [0, 1]
  function sample(u, v) {
    // 1. Squircle background tile
    const rad = 0.22;
    const qx = Math.max(0, Math.abs(u - 0.5) - (0.5 - rad));
    const qy = Math.max(0, Math.abs(v - 0.5) - (0.5 - rad));
    const dCorner = Math.hypot(qx, qy);
    if (dCorner > rad) {
      return [0, 0, 0, 0]; // Transparent
    }

    // Border stroke
    if (dCorner > rad - 0.025 || u <= 0.025 || u >= 0.975 || v <= 0.025 || v >= 0.975) {
      return theme.border;
    }

    // 2. Dream Star (upper center: cx=0.5, cy=0.25, radius=0.13)
    const sx = Math.abs(u - 0.50) / 0.13;
    const sy = Math.abs(v - 0.25) / 0.13;
    if (sx < 1.0 && sy < 1.0) {
      if (Math.sqrt(sx) + Math.sqrt(sy) <= 1.0) {
        if (Math.hypot(u - 0.50, v - 0.25) < 0.025) {
          return theme.starCore;
        }
        return theme.accent;
      }
    }

    // 3. Central Spine / Ribbon
    if (Math.abs(u - 0.50) <= 0.022 && v >= 0.38 && v <= 0.88) {
      return theme.accent;
    }

    // 4. Open Book Left Page
    if (u >= 0.16 && u <= 0.48) {
      const prog = (u - 0.16) / 0.32;
      const yTop = 0.44 - 0.06 * Math.sin(Math.PI * prog);
      const yBot = 0.84 - 0.06 * Math.sin(Math.PI * prog);

      if (v >= yTop && v <= yBot) {
        // Outline or lines
        if (v <= yTop + 0.028 || v >= yBot - 0.028 || u <= 0.185 || u >= 0.46) {
          return theme.accent;
        }
        // Horizontal page lines
        const vRel = (v - yTop) / (yBot - yTop);
        if ((vRel >= 0.32 && vRel <= 0.37) ||
            (vRel >= 0.52 && vRel <= 0.57) ||
            (vRel >= 0.72 && vRel <= 0.77)) {
          return theme.accentAlt;
        }
        return theme.pageFill;
      }
    }

    // 5. Open Book Right Page
    if (u >= 0.52 && u <= 0.84) {
      const prog = (u - 0.52) / 0.32;
      const yTop = 0.44 - 0.06 * Math.sin(Math.PI * (1 - prog));
      const yBot = 0.84 - 0.06 * Math.sin(Math.PI * (1 - prog));

      if (v >= yTop && v <= yBot) {
        if (v <= yTop + 0.028 || v >= yBot - 0.028 || u >= 0.815 || u <= 0.54) {
          return theme.accent;
        }
        const vRel = (v - yTop) / (yBot - yTop);
        if ((vRel >= 0.32 && vRel <= 0.37) ||
            (vRel >= 0.52 && vRel <= 0.57) ||
            (vRel >= 0.72 && vRel <= 0.77)) {
          return theme.accentAlt;
        }
        return theme.pageFill;
      }
    }

    // Default Tile Background
    return theme.bg;
  }

  // Supersampling (2x2 per pixel for ultra smooth anti-aliased output)
  for (let y = 0; y < size; y++) {
    const rowOffset = y * (rowBytes + 1);
    raw[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      const s1 = sample((x + 0.25) / size, (y + 0.25) / size);
      const s2 = sample((x + 0.75) / size, (y + 0.25) / size);
      const s3 = sample((x + 0.25) / size, (y + 0.75) / size);
      const s4 = sample((x + 0.75) / size, (y + 0.75) / size);

      const r = Math.round((s1[0] + s2[0] + s3[0] + s4[0]) / 4);
      const g = Math.round((s1[1] + s2[1] + s3[1] + s4[1]) / 4);
      const b = Math.round((s1[2] + s2[2] + s3[2] + s4[2]) / 4);
      const a = Math.round((s1[3] + s2[3] + s3[3] + s4[3]) / 4);

      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
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

// ── Executar Geração ─────────────────────────────────────────────
console.log('Generating Yekun Dream Theme Icons...');

// 1. SVGs
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), generateSvg('dark'));
fs.writeFileSync(path.join(iconsDir, 'icon-dark.svg'), generateSvg('dark'));
fs.writeFileSync(path.join(iconsDir, 'icon-light.svg'), generateSvg('light'));
fs.writeFileSync(path.join(iconsDir, 'icon-pink.svg'), generateSvg('pink'));
fs.writeFileSync(path.join(iconsDir, 'icon-neon.svg'), generateSvg('neon'));
console.log('✓ Master SVGs generated: icon.svg, icon-dark.svg, icon-light.svg, icon-pink.svg, icon-neon.svg');

// 2. Default Manifest PNGs (Dark Official)
[16, 32, 48, 128].forEach(size => {
  const buf = createThemePng(size, 'dark');
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
  console.log(`✓ Generated default icons/icon${size}.png (${buf.length} bytes)`);
});

// 3. Theme Variants
['dark', 'light', 'pink', 'neon'].forEach(themeKey => {
  [16, 32, 48, 128].forEach(size => {
    const buf = createThemePng(size, themeKey);
    fs.writeFileSync(path.join(iconsDir, `icon-${themeKey}-${size}.png`), buf);
    console.log(`✓ Generated icons/icon-${themeKey}-${size}.png (${buf.length} bytes)`);
  });
});

console.log('✓ All Yekun Dream icons successfully generated!');
