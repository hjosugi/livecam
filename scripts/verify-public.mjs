#!/usr/bin/env node

const [baseUrlInput, expectedRevision, expectedVersion = '0.1.0'] = process.argv.slice(2);
if (!baseUrlInput || !expectedRevision) {
  console.error('Usage: npm run verify:public -- <base-url> <full-revision> [version]');
  process.exit(2);
}

const baseUrl = new URL(baseUrlInput.endsWith('/') ? baseUrlInput : `${baseUrlInput}/`);
const cacheBust = `verify=${Date.now()}`;

async function fetchRequired(path, format) {
  const url = new URL(path, baseUrl);
  url.search = cacheBust;
  const response = await fetch(url, {
    headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'OpenLiveCamAtlas-Verifier/0.1' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return format === 'json' ? response.json() : response.text();
}

const [html, buildInfo, catalog] = await Promise.all([
  fetchRequired('index.html', 'text'),
  fetchRequired('build-info.json', 'json'),
  fetchRequired('data/cameras.json', 'json'),
]);

const failures = [];
if (!html.includes('Open LiveCam Atlas')) failures.push('index.html does not contain the product title');
if (buildInfo.revision !== expectedRevision) {
  failures.push(`revision mismatch: expected ${expectedRevision}, got ${buildInfo.revision}`);
}
if (buildInfo.version !== expectedVersion) {
  failures.push(`version mismatch: expected ${expectedVersion}, got ${buildInfo.version}`);
}
if (buildInfo.catalogEntries !== catalog.cameras?.length) {
  failures.push('build metadata catalog count does not match deployed catalog');
}
if (!Array.isArray(catalog.cameras) || catalog.cameras.length < 5_000) {
  failures.push(`deployed catalog is unexpectedly small: ${catalog.cameras?.length ?? 'invalid'}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Public deployment OK: v${buildInfo.version} ${buildInfo.revision} with ${catalog.cameras.length.toLocaleString('en-US')} entries`,
);
