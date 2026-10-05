const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const requiredFiles = [
  'icons/icon.svg',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

let failed = false;
for (const file of requiredFiles) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing expected icon file: ${file}`);
    failed = true;
  } else {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      console.error(`Icon file is empty: ${file}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('Icon verification passed.');
  process.exit(0);
}
