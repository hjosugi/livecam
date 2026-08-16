import type { Camera, CameraCatalog, FilterState } from './types';

const normalize = (value: string): string =>
  value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();

export function filterCameras(
  cameras: Camera[],
  filters: FilterState,
  favorites: ReadonlySet<string>,
): Camera[] {
  const query = normalize(filters.query);

  return cameras.filter((camera) => {
    if (filters.media === 'favorites' && !favorites.has(camera.id)) return false;
    if (filters.media !== 'all' && filters.media !== 'favorites' && camera.media.kind !== filters.media) {
      return false;
    }
    if (filters.country !== 'all' && camera.countryCode !== filters.country) return false;
    if (!query) return true;

    const haystack = normalize(
      [
        camera.name,
        camera.region,
        camera.country,
        camera.countryCode,
        camera.source.name,
        camera.direction ?? '',
      ].join(' '),
    );
    return haystack.includes(query);
  });
}

export function sortByDistance(cameras: Camera[], latitude: number, longitude: number): Camera[] {
  return [...cameras].sort(
    (a, b) =>
      haversineKm(latitude, longitude, a.latitude, a.longitude) -
      haversineKm(latitude, longitude, b.latitude, b.longitude),
  );
}

export function sortForDiscovery(cameras: Camera[]): Camera[] {
  const rank = (camera: Camera): number => {
    if (camera.id === 'portal:jp-mlit-road') return 0;
    if (camera.media.kind === 'portal') return 1;
    if (camera.media.kind === 'hls') return 2;
    return 3;
  };

  return [...cameras].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      a.country.localeCompare(b.country, 'ja') ||
      a.region.localeCompare(b.region, 'ja') ||
      a.name.localeCompare(b.name, 'ja'),
  );
}

export function haversineKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = radians(latitudeB - latitudeA);
  const deltaLongitude = radians(longitudeB - longitudeA);
  const sinLatitude = Math.sin(deltaLatitude / 2);
  const sinLongitude = Math.sin(deltaLongitude / 2);
  const arc =
    sinLatitude * sinLatitude +
    Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * sinLongitude * sinLongitude;

  return 2 * earthRadiusKm * Math.asin(Math.sqrt(arc));
}

export function validateCatalog(input: unknown): CameraCatalog {
  if (!input || typeof input !== 'object') throw new Error('カタログ形式が不正です');
  const catalog = input as Partial<CameraCatalog>;
  if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.cameras) || !Array.isArray(catalog.sources)) {
    throw new Error('未対応のカタログ形式です');
  }
  return catalog as CameraCatalog;
}

export function countryOptions(cameras: Camera[]): Array<{ code: string; label: string; count: number }> {
  const countries = new Map<string, { label: string; count: number }>();
  for (const camera of cameras) {
    const current = countries.get(camera.countryCode);
    countries.set(camera.countryCode, {
      label: camera.country,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...countries.entries()]
    .map(([code, value]) => ({ code, ...value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ja'));
}
