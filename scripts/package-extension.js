#!/usr/bin/env node
/* ════════════════════════════════════════════════════════
   Yekun Dream — scripts/package-extension.js
   Gera pacote limpo .zip pronto para submissão na
   Chrome Web Store / Firefox Add-ons (sem testes/docs).
   ════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version = manifest.version || '1.2.0';
const zipFileName = `yekun-dream-v${version}.zip`;
const zipPath = path.join(distDir, zipFileName);

// Arquivos e diretórios essenciais para o pacote de produção
const requiredFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'identity-service.js',
  'storage-local.js',
  'canonical-resolver.js',
  'alias-crowd-service.js',
  'sync-service.js',
  'popup.html',
  'popup.css',
  'popup.js'
];

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Coleta todos os ícones necessários
const iconsDir = path.join(rootDir, 'icons');
const iconFiles = fs.readdirSync(iconsDir)
  .filter(f => f.endsWith('.png') || f.endsWith('.svg'))
  .map(f => path.join('icons', f));

const allItemsToZip = [...requiredFiles, ...iconFiles];

console.log('═══════════════════════════════════════════════════════');
console.log(`   Empacotador Yekun Dream — v${version}`);
console.log('═══════════════════════════════════════════════════════\n');

// Garante que todos os arquivos existem antes de empacotar
for (const file of allItemsToZip) {
  const fullPath = path.join(rootDir, file);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Erro: Arquivo obrigatório não encontrado: ${file}`);
    process.exit(1);
  }
}

const { execFileSync } = require('child_process');

const pythonCode = `
import zipfile, os, sys

root_dir = sys.argv[1]
zip_path = sys.argv[2]
files = sys.argv[3:]

if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for rel_path in files:
        full_path = os.path.join(root_dir, rel_path)
        zf.write(full_path, arcname=rel_path)
        print(f"  + {rel_path}")

size_kb = os.path.getsize(zip_path) / 1024
print(f"\\n✓ Pacote criado com sucesso: {zip_path} ({size_kb:.1f} KB)")
`;

try {
  execFileSync('python3', ['-c', pythonCode, rootDir, zipPath, ...allItemsToZip], { stdio: 'inherit' });
  console.log('\n🚀 O arquivo está pronto para upload no Chrome Web Store Developer Dashboard!');
} catch (err) {
  console.error('❌ Falha ao criar arquivo .zip:', err.message);
  process.exit(1);
}
