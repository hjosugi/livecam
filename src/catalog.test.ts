import { describe, expect, it } from 'vitest';
import { filterCameras, haversineKm, sortByDistance, sortForDiscovery, validateCatalog } from './catalog';
import type { Camera } from './types';

const camera = (overrides: Partial<Camera> = {}): Camera => ({
  id: 'test-1',
  name: '東京 道路カメラ',
  latitude: 35.681,
  longitude: 139.767,
  country: '日本',
  countryCode: 'JP',
  region: '東京都',
  category: 'traffic',
  media: { kind: 'image', imageUrl: 'https://example.com/camera.jpg' },
  source: { name: 'テスト機関', url: 'https://example.com', attribution: 'Source: test' },
  ...overrides,
});

describe('filterCameras', () => {
  const cameras = [
    camera(),
    camera({ id: 'test-2', name: 'Helsinki weather', country: 'フィンランド', countryCode: 'FI' }),
  ];

  it('normalizes full-width search text', () => {
    expect(
      filterCameras(cameras, { query: 'ＴＯＫＹＯ', media: 'all', country: 'all' }, new Set()),
    ).toHaveLength(0);
    expect(
      filterCameras(cameras, { query: '道路', media: 'all', country: 'all' }, new Set()),
    ).toEqual([cameras[0]]);
  });

  it('filters favorites and country independently', () => {
    expect(
      filterCameras(cameras, { query: '', media: 'favorites', country: 'FI' }, new Set(['test-2'])),
    ).toEqual([cameras[1]]);
  });
});

describe('distance helpers', () => {
  it('calculates the Tokyo to Osaka distance approximately', () => {
    expect(haversineKm(35.681, 139.767, 34.702, 135.495)).toBeGreaterThan(390);
    expect(haversineKm(35.681, 139.767, 34.702, 135.495)).toBeLessThan(410);
  });

  it('sorts nearest first without mutating the input', () => {
    const far = camera({ id: 'far', latitude: 0, longitude: 0 });
    const near = camera({ id: 'near', latitude: 35.68, longitude: 139.76 });
    const input = [far, near];
    expect(sortByDistance(input, 35.681, 139.767).map((item) => item.id)).toEqual(['near', 'far']);
    expect(input[0]?.id).toBe('far');
  });
});

describe('sortForDiscovery', () => {
  it('places the Japanese official portal first, followed by other portals and streams', () => {
    const items = [
      camera({ id: 'image', media: { kind: 'image', imageUrl: 'https://example.com/a.jpg' } }),
      camera({ id: 'stream', media: { kind: 'hls', imageUrl: 'https://example.com/a.jpg', streamUrl: 'https://example.com/a.m3u8' } }),
      camera({ id: 'portal:other', media: { kind: 'portal' }, category: 'portal' }),
      camera({ id: 'portal:jp-mlit-road', media: { kind: 'portal' }, category: 'portal' }),
    ];
    expect(sortForDiscovery(items).map((item) => item.id)).toEqual([
      'portal:jp-mlit-road',
      'portal:other',
      'stream',
      'image',
    ]);
    expect(items[0]?.id).toBe('image');
  });
});

describe('validateCatalog', () => {
  it('rejects unknown schemas', () => {
    expect(() => validateCatalog({ schemaVersion: 2, cameras: [], sources: [] })).toThrow(
      '未対応のカタログ形式です',
    );
  });
});
