#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(projectRoot, 'public/data/cameras.json');
const requestTimeoutMs = 25_000;
const userAgent = 'OpenLiveCamAtlas/0.1 (+https://github.com/hjosugi/livecam)';

const portalCameras = [
  {
    id: 'portal:jp-mlit-road',
    name: '日本全国 道路ライブカメラ',
    latitude: 36.2048,
    longitude: 138.2529,
    country: '日本',
    countryCode: 'JP',
    region: '全国',
    category: 'portal',
    media: { kind: 'portal' },
    source: {
      name: '国土交通省',
      url: 'https://www.mlit.go.jp/road/bosai/LIVEcamera.html',
      attribution: '出典: 国土交通省「全国のライブカメラ」',
    },
  },
  {
    id: 'portal:ca-drivebc',
    name: 'DriveBC HighwayCams',
    latitude: 53.7267,
    longitude: -127.6476,
    country: 'カナダ',
    countryCode: 'CA',
    region: 'British Columbia',
    category: 'portal',
    media: { kind: 'portal' },
    source: {
      name: 'Government of British Columbia',
      url: 'https://www.drivebc.ca/cameras',
      termsUrl: 'https://www2.gov.bc.ca/gov/content/home/copyright',
      attribution: 'Source: Province of British Columbia / DriveBC',
    },
  },
  {
    id: 'portal:us-oregon-tripcheck',
    name: 'Oregon TripCheck cameras',
    latitude: 43.8041,
    longitude: -120.5542,
    country: 'アメリカ合衆国',
    countryCode: 'US',
    region: 'Oregon',
    category: 'portal',
    media: { kind: 'portal' },
    source: {
      name: 'Oregon Department of Transportation',
      url: 'https://tripcheck.com/',
      termsUrl: 'https://tripcheck.com/Pages/API',
      attribution: 'Source: Oregon DOT / TripCheck',
    },
  },
  {
    id: 'portal:gb-traffic-scotland',
    name: 'Traffic Scotland cameras',
    latitude: 56.4907,
    longitude: -4.2026,
    country: 'イギリス',
    countryCode: 'GB',
    region: 'Scotland',
    category: 'portal',
    media: { kind: 'portal' },
    source: {
      name: 'Traffic Scotland',
      url: 'https://www.traffic.gov.scot/traffic-cameras',
      attribution: 'Source: Traffic Scotland',
    },
  },
  {
    id: 'portal:nz-journeys',
    name: 'New Zealand traffic cameras',
    latitude: -41.2866,
    longitude: 174.7756,
    country: 'ニュージーランド',
    countryCode: 'NZ',
    region: '全国',
    category: 'portal',
    media: { kind: 'portal' },
    source: {
      name: 'NZ Transport Agency Waka Kotahi',
      url: 'https://www.journeys.nzta.govt.nz/traffic-cameras',
      termsUrl:
        'https://www.nzta.govt.nz/about-us/our-data-and-official-information/use-our-data/terms-of-use/',
      attribution: 'Source: NZ Transport Agency Waka Kotahi',
    },
  },
  {
    id: 'portal:no-vegvesen',
    name: 'Norway traffic cameras',
    latitude: 64.5732,
    longitude: 11.528,
    country: 'ノルウェー',
    countryCode: 'NO',
    region: '全国',
    category: 'portal',
    media: { kind: 'portal' },
    source: {
      name: 'Statens vegvesen',
      url: 'https://www.vegvesen.no/trafikk/#/kamera',
      attribution: 'Source: Statens vegvesen',
    },
  },
  {
    id: 'portal:is-umferdin',
    name: 'Iceland road cameras',
    latitude: 64.9631,
    longitude: -19.0208,
    country: 'アイスランド',
    countryCode: 'IS',
    region: '全国',
    category: 'portal',
    media: { kind: 'portal' },
    source: {
      name: 'Icelandic Road and Coastal Administration',
      url: 'https://umferdin.is/en/cameras',
      attribution: 'Source: Icelandic Road and Coastal Administration',
    },
  },
];

async function fetchJson(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'User-Agent': userAgent,
      ...headers,
    },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

async function fetchText(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/csv',
      'Accept-Encoding': 'gzip',
      'User-Agent': userAgent,
      ...headers,
    },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }

  const headers = rows.shift() ?? [];
  return rows
    .filter((values) => values.some(Boolean))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function cleanText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replaceAll('_', ' · ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

async function fetchFintraffic() {
  const endpoint = 'https://tie.digitraffic.fi/api/weathercam/v1/stations';
  const payload = await fetchJson(endpoint, {
    'Digitraffic-User': userAgent,
  });
  const features = Array.isArray(payload.features) ? payload.features : [];

  const cameras = features.flatMap((feature) => {
    const longitude = validCoordinate(feature?.geometry?.coordinates?.[0], -180, 180);
    const latitude = validCoordinate(feature?.geometry?.coordinates?.[1], -90, 90);
    const presets = Array.isArray(feature?.properties?.presets) ? feature.properties.presets : [];
    const preset = presets.find((item) => item?.inCollection && typeof item.id === 'string');
    const stationId = feature?.properties?.id;
    if (latitude === null || longitude === null || !preset || typeof stationId !== 'string') return [];

    return [
      {
        id: `fintraffic:${stationId}`,
        name: cleanText(feature.properties.name, `Weather camera ${stationId}`),
        latitude,
        longitude,
        country: 'フィンランド',
        countryCode: 'FI',
        region: 'Finland',
        category: 'weather',
        media: {
          kind: 'image',
          imageUrl: `https://weathercam.digitraffic.fi/${encodeURIComponent(preset.id)}.jpg`,
        },
        source: {
          name: 'Fintraffic / Digitraffic',
          url: 'https://www.digitraffic.fi/en/road-traffic/',
          termsUrl: 'https://www.digitraffic.fi/en/terms-of-service/',
          attribution: 'Source: Fintraffic / digitraffic.fi, license CC BY 4.0',
        },
        observedAt: feature.properties.dataUpdatedTime,
      },
    ];
  });

  return { id: 'fintraffic', name: 'Fintraffic / Digitraffic', homepage: endpoint, cameras };
}

async function fetchCaltrans() {
  const documentation = 'https://cwwp2.dot.ca.gov/documentation/cctv/cctv.htm';
  const districts = Array.from({ length: 12 }, (_, index) => index + 1);
  const results = await Promise.allSettled(
    districts.map((district) =>
      fetchJson(
        `https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${String(district).padStart(2, '0')}.json`,
      ),
    ),
  );

  const failedDistricts = results.flatMap((result, index) =>
    result.status === 'rejected' ? [districts[index]] : [],
  );
  if (failedDistricts.length === districts.length) {
    throw new Error('All Caltrans district feeds failed');
  }
  if (failedDistricts.length) {
    console.warn(`Caltrans districts unavailable: ${failedDistricts.join(', ')}`);
  }

  const cameras = results.flatMap((result, districtIndex) => {
    if (result.status === 'rejected') return [];
    const records = Array.isArray(result.value?.data) ? result.value.data : [];
    const district = districts[districtIndex];

    return records.flatMap((record) => {
      const cctv = record?.cctv;
      const location = cctv?.location;
      const imageData = cctv?.imageData;
      const imageUrl = imageData?.static?.currentImageURL;
      const streamUrl = imageData?.streamingVideoURL;
      const latitude = validCoordinate(location?.latitude, -90, 90);
      const longitude = validCoordinate(location?.longitude, -180, 180);
      if (
        latitude === null ||
        longitude === null ||
        typeof imageUrl !== 'string' ||
        !imageUrl.startsWith('https://')
      ) {
        return [];
      }

      const index = String(cctv?.index ?? `${latitude}-${longitude}`);
      const hasStream = typeof streamUrl === 'string' && streamUrl.startsWith('https://');
      const date = cctv?.recordTimestamp?.recordDate;
      const time = cctv?.recordTimestamp?.recordTime;
      const nearbyPlace = cleanText(location?.nearbyPlace, 'California');
      const county = cleanText(location?.county, 'California');

      return [
        {
          id: `caltrans:d${district}:${index}`,
          name: cleanText(location?.locationName, `Caltrans camera ${index}`),
          latitude,
          longitude,
          country: 'アメリカ合衆国',
          countryCode: 'US',
          region: `${nearbyPlace} · ${county} County, CA`,
          category: 'traffic',
          direction: cleanText(location?.direction, ''),
          media: {
            kind: hasStream ? 'hls' : 'image',
            imageUrl,
            ...(hasStream ? { streamUrl } : {}),
          },
          source: {
            name: `Caltrans District ${district}`,
            url: documentation,
            termsUrl: 'https://cwwp2.dot.ca.gov/documentation/conditions.htm',
            attribution: `Source: California Department of Transportation, District ${district}`,
          },
          ...(date && time ? { observedAt: `${date}T${time}` } : {}),
        },
      ];
    });
  });

  return {
    id: 'caltrans',
    name: 'California Department of Transportation',
    homepage: documentation,
    cameras,
    partial: failedDistricts.length > 0,
  };
}

async function fetchDriveBC() {
  const datasetUrl = 'https://open.canada.ca/data/en/dataset/6b39a910-6c77-476f-ac96-7b4f18849b1c';
  const csvUrl =
    'https://catalogue.data.gov.bc.ca/dataset/6b39a910-6c77-476f-ac96-7b4f18849b1c/resource/a9d52d85-8402-4ce7-b2ac-a2779837c48a/download/webcams.csv';
  const rows = parseCsv(await fetchText(csvUrl));
  const cameras = rows.flatMap((row) => {
    const latitude = validCoordinate(row.latitude, -90, 90);
    const longitude = validCoordinate(row.longitude, -180, 180);
    const id = row.id?.trim();
    const imageUrl = row.links_imageDisplay?.trim();
    const pageUrl = row.links_bchighwaycam?.trim();
    if (
      latitude === null ||
      longitude === null ||
      !id ||
      !imageUrl?.startsWith('https://') ||
      !pageUrl?.startsWith('https://')
    ) {
      return [];
    }

    const highway = row.highway_number?.trim() ? `Highway ${row.highway_number.trim()}` : '';
    const area = cleanText(row.highway_locationDescription, 'British Columbia');
    return [
      {
        id: `drivebc:${id}`,
        name: cleanText(row.camName, cleanText(row.caption, `DriveBC camera ${id}`)),
        latitude,
        longitude,
        country: 'カナダ',
        countryCode: 'CA',
        region: [area, highway].filter(Boolean).join(' · '),
        category: 'traffic',
        direction: cleanText(row.orientation, ''),
        media: { kind: 'image', imageUrl },
        source: {
          name: 'Province of British Columbia / DriveBC',
          url: pageUrl,
          termsUrl:
            'https://www2.gov.bc.ca/gov/content/data/open-data/open-government-license-bc',
          attribution:
            'Source: Province of British Columbia / DriveBC, Open Government Licence - British Columbia',
        },
      },
    ];
  });

  return {
    id: 'drivebc',
    name: 'Province of British Columbia / DriveBC',
    homepage: datasetUrl,
    cameras,
  };
}

async function main() {
  const feeds = await Promise.allSettled([fetchFintraffic(), fetchCaltrans(), fetchDriveBC()]);
  const successful = feeds.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
  for (const result of feeds) {
    if (result.status === 'rejected') console.warn(`Source sync failed: ${result.reason}`);
  }
  if (!successful.length) throw new Error('No remote camera sources could be synchronized');

  const cameras = [...portalCameras, ...successful.flatMap((feed) => feed.cameras)].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  const catalog = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    cameras,
    sources: [
      {
        id: 'official-portals',
        name: 'Official camera portals',
        count: portalCameras.length,
        status: 'ok',
        homepage: 'https://www.mlit.go.jp/road/bosai/LIVEcamera.html',
      },
      ...successful.map((feed) => ({
        id: feed.id,
        name: feed.name,
        count: feed.cameras.length,
        status: feed.partial ? 'partial' : 'ok',
        homepage: feed.homepage,
      })),
    ],
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${cameras.length.toLocaleString('en-US')} entries to ${outputPath}`);
  for (const source of catalog.sources) {
    console.log(`- ${source.name}: ${source.count.toLocaleString('en-US')} (${source.status})`);
  }
}

await main();
