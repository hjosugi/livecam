#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(resolve(projectRoot, 'package.json'), 'utf8'));
const catalog = JSON.parse(await readFile(resolve(projectRoot, 'public/data/cameras.json'), 'utf8'));
const revision = process.env.GITHUB_SHA ?? process.env.BUILD_REVISION ?? 'local';
const outputPath = resolve(projectRoot, 'public/build-info.json');
const buildInfo = {
  schemaVersion: 1,
  name: packageJson.name,
  version: packageJson.version,
  revision,
  builtAt: new Date().toISOString(),
  catalogGeneratedAt: catalog.generatedAt,
  catalogEntries: catalog.cameras.length,
  ...(process.env.GITHUB_RUN_ID ? { githubRunId: process.env.GITHUB_RUN_ID } : {}),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');
console.log(`Wrote build metadata for ${buildInfo.version} at ${revision}`);
