#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targets = [
  '.next',
  '.turbo',
  path.join('.vercel', 'output'),
  'tsconfig.tsbuildinfo',
];

async function removeTarget(relativeTarget) {
  const absoluteTarget = path.resolve(root, relativeTarget);

  try {
    await fs.rm(absoluteTarget, { recursive: true, force: true });
    console.log(`removido: ${relativeTarget}`);
  } catch (error) {
    console.warn(`ignorado: ${relativeTarget}`);
    if (process.env.DEBUG_CLEAN === '1') {
      console.warn(error);
    }
  }
}

async function main() {
  for (const target of targets) {
    await removeTarget(target);
  }
}

main().catch((error) => {
  console.error('Falha ao limpar artefatos de build.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
