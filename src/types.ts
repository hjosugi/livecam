export type MediaKind = 'hls' | 'image' | 'portal';
export type CameraCategory = 'traffic' | 'weather' | 'city' | 'nature' | 'portal';

export interface CameraSource {
  name: string;
  url: string;
  termsUrl?: string;
  attribution: string;
}

export interface CameraMedia {
  kind: MediaKind;
  imageUrl?: string;
  streamUrl?: string;
}

export interface Camera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  region: string;
  category: CameraCategory;
  direction?: string;
  media: CameraMedia;
  source: CameraSource;
  observedAt?: string;
}

export interface CatalogSourceSummary {
  id: string;
  name: string;
  count: number;
  status: 'ok' | 'partial' | 'fallback';
  homepage: string;
}

export interface CameraCatalog {
  schemaVersion: 1;
  generatedAt: string;
  cameras: Camera[];
  sources: CatalogSourceSummary[];
}

export type MediaFilter = 'all' | MediaKind | 'favorites';

export interface FilterState {
  query: string;
  media: MediaFilter;
  country: string;
}
