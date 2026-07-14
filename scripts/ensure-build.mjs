#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  path.join('.next', 'BUILD_ID'),
  path.join('.next', 'prerender-manifest.json'),
];

const missingFiles = requiredFiles.filter((file) => !fs.existsSync(path.resolve(root, file)));

if (missingFiles.length > 0) {
  console.error('Build de produção ausente ou inconsistente.');
  console.error('Antes de usar `npm run start`, execute:');
  console.error('  npm run build:fresh');
  process.exit(1);
}
