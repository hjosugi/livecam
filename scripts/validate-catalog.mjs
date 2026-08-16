#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const inputPath = resolve(process.cwd(), process.argv[2] ?? 'public/data/cameras.json');
const errors = [];
const directSourceHosts = {
  caltrans: new Set(['cwwp2.dot.ca.gov', 'wzmedia.dot.ca.gov']),
  drivebc: new Set(['images.drivebc.ca', 'www2.gov.bc.ca']),
  fintraffic: new Set(['www.digitraffic.fi', 'weathercam.digitraffic.fi']),
};

function checkHttps(value, field, id) {
  if (typeof value !== 'string') {
    errors.push(`${id}: ${field} must be a string`);
    return null;
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') errors.push(`${id}: ${field} must use HTTPS`);
    if (url.username || url.password) errors.push(`${id}: ${field} must not contain credentials`);
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
      errors.push(`${id}: ${field} must not target a local host`);
    }
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname)) {
      errors.push(`${id}: ${field} must not target a private network`);
    }
    return url;
  } catch {
    errors.push(`${id}: ${field} is not a valid URL`);
    return null;
  }
}

const catalog = JSON.parse(await readFile(inputPath, 'utf8'));
if (catalog.schemaVersion !== 1) errors.push('schemaVersion must be 1');
if (!Number.isFinite(Date.parse(catalog.generatedAt))) errors.push('generatedAt must be an ISO date');
if (!Array.isArray(catalog.cameras) || catalog.cameras.length === 0) errors.push('cameras must be non-empty');
if (!Array.isArray(catalog.sources) || catalog.sources.length === 0) errors.push('sources must be non-empty');

const ids = new Set();
for (const camera of catalog.cameras ?? []) {
  const id = typeof camera.id === 'string' ? camera.id : '<missing-id>';
  if (ids.has(id)) errors.push(`${id}: duplicate id`);
  ids.add(id);
  if (!camera.name || !camera.country || !camera.countryCode || !camera.region) {
    errors.push(`${id}: required display fields are missing`);
  }
  if (!Number.isFinite(camera.latitude) || camera.latitude < -90 || camera.latitude > 90) {
    errors.push(`${id}: latitude is out of range`);
  }
  if (!Number.isFinite(camera.longitude) || camera.longitude < -180 || camera.longitude > 180) {
    errors.push(`${id}: longitude is out of range`);
  }
  if (!['hls', 'image', 'portal'].includes(camera.media?.kind)) {
    errors.push(`${id}: unsupported media kind`);
  }
  if (camera.media?.kind === 'image' && !camera.media.imageUrl) {
    errors.push(`${id}: image media requires imageUrl`);
  }
  if (camera.media?.kind === 'hls' && (!camera.media.imageUrl || !camera.media.streamUrl)) {
    errors.push(`${id}: HLS media requires streamUrl and fallback imageUrl`);
  }
  for (const [field, value] of [
    ['source.url', camera.source?.url],
    ...(camera.source?.termsUrl ? [['source.termsUrl', camera.source.termsUrl]] : []),
    ...(camera.media?.imageUrl ? [['media.imageUrl', camera.media.imageUrl]] : []),
    ...(camera.media?.streamUrl ? [['media.streamUrl', camera.media.streamUrl]] : []),
  ]) {
    const url = checkHttps(value, field, id);
    if (camera.category !== 'portal' && url) {
      const sourceId = id.split(':')[0];
      const allowedHosts = directSourceHosts[sourceId];
      if (!allowedHosts?.has(url.hostname)) {
        errors.push(`${id}: ${field} host is not allow-listed (${url.hostname})`);
      }
    }
  }
}

const sourceTotal = (catalog.sources ?? []).reduce((total, source) => total + Number(source.count ?? 0), 0);
if (sourceTotal !== (catalog.cameras?.length ?? 0)) {
  errors.push(`source counts (${sourceTotal}) do not match cameras (${catalog.cameras?.length ?? 0})`);
}

if (errors.length) {
  console.error(`Catalog validation failed with ${errors.length} error(s):`);
  for (const error of errors.slice(0, 50)) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Catalog OK: ${catalog.cameras.length.toLocaleString('en-US')} unique HTTPS-only entries`);
}
