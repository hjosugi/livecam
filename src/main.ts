import L, { type CircleMarker, type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { countryOptions, filterCameras, sortByDistance, sortForDiscovery, validateCatalog } from './catalog';
import type { Camera, CameraCatalog, FilterState, MediaFilter } from './types';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App root was not found');

app.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="Open LiveCam Atlas ホーム">
        <span class="brand-mark" aria-hidden="true"><span></span></span>
        <span><strong>OPEN LIVECAM</strong><small>PUBLIC CAMERA ATLAS</small></span>
      </a>
      <div class="topbar-meta">
        <span class="network-status"><i aria-hidden="true"></i><span id="source-status">公式データ読込中</span></span>
        <a class="github-link" href="https://github.com/hjosugi/livecam" target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a>
      </div>
    </header>

    <main class="workspace">
      <aside class="explorer" aria-label="カメラ検索">
        <div class="explorer-heading">
          <div>
            <p class="eyebrow">EXPLORE THE PUBLIC WORLD</p>
            <h1>公開されている今を、<br />ひとつの地図から。</h1>
          </div>
          <button class="mobile-map-button" id="mobile-map-button" type="button">地図を見る</button>
        </div>

        <p class="intro-copy">行政機関などが公開する道路・気象カメラを横断検索。映像は選ぶまで外部へ接続しません。</p>

        <div class="search-box">
          <span aria-hidden="true">⌕</span>
          <label class="sr-only" for="camera-search">場所、道路、公開元を検索</label>
          <input id="camera-search" type="search" autocomplete="off" placeholder="場所、道路、公開元を検索" />
          <kbd>⌘ K</kbd>
        </div>

        <div class="filter-row" id="media-filters" aria-label="メディア種別">
          <button class="filter-chip is-active" type="button" data-media="all" aria-pressed="true">すべて</button>
          <button class="filter-chip" type="button" data-media="hls" aria-pressed="false"><i class="dot dot-live"></i>HLS</button>
          <button class="filter-chip" type="button" data-media="image" aria-pressed="false"><i class="dot dot-image"></i>更新画像</button>
          <button class="filter-chip" type="button" data-media="portal" aria-pressed="false">公式一覧</button>
          <button class="filter-chip" type="button" data-media="favorites" aria-pressed="false">☆ 保存</button>
        </div>

        <div class="control-row">
          <label class="select-wrap">
            <span class="sr-only">国・地域</span>
            <select id="country-filter"><option value="all">すべての国・地域</option></select>
          </label>
          <button class="location-button" id="location-button" type="button" title="現在地は保存・送信されません">
            <span aria-hidden="true">⌖</span> 近い順
          </button>
        </div>

        <div class="result-heading">
          <p><strong id="result-count">—</strong><span> 件を表示</span></p>
          <button id="reset-filters" class="text-button" type="button">条件をリセット</button>
        </div>

        <div id="camera-results" class="camera-list" tabindex="-1" aria-live="polite" aria-busy="true"></div>
        <button class="load-more" id="load-more" type="button" hidden>さらに表示</button>

        <footer class="explorer-footer">
          <a href="${import.meta.env.BASE_URL}about.html">このサイトについて</a>
          <span>•</span>
          <a href="https://github.com/hjosugi/livecam/issues/new?template=source.yml" target="_blank" rel="noreferrer">公開ソースを提案</a>
        </footer>
      </aside>

      <section class="map-panel" id="map-panel" aria-label="世界の公開カメラ地図">
        <div id="map" role="application" aria-label="カメラ位置を示す操作可能な地図"></div>
        <div class="map-stats" aria-live="polite">
          <span><i class="dot dot-live"></i><strong id="hls-count">—</strong> HLS</span>
          <span><i class="dot dot-image"></i><strong id="image-count">—</strong> 更新画像</span>
          <span><i class="dot dot-portal"></i><strong id="portal-count">—</strong> 公式一覧</span>
        </div>
        <button class="desktop-near-button" id="map-near-button" type="button"><span aria-hidden="true">⌖</span> 現在地へ</button>
        <div class="map-note">公開元の稼働状況はリアルタイム検証していません</div>
      </section>

      <aside class="detail-panel" id="detail-panel" aria-label="カメラ詳細" aria-hidden="true" inert>
        <button class="detail-close" id="detail-close" type="button" aria-label="詳細を閉じる">×</button>
        <div id="detail-content"></div>
      </aside>
    </main>

    <div class="toast" id="toast" role="status" aria-live="polite"></div>
  </div>
`;

const requiredElement = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
};

const searchInput = requiredElement<HTMLInputElement>('#camera-search');
const countrySelect = requiredElement<HTMLSelectElement>('#country-filter');
const resultsElement = requiredElement<HTMLDivElement>('#camera-results');
const resultCount = requiredElement<HTMLElement>('#result-count');
const loadMoreButton = requiredElement<HTMLButtonElement>('#load-more');
const detailPanel = requiredElement<HTMLElement>('#detail-panel');
const detailContent = requiredElement<HTMLDivElement>('#detail-content');
const sourceStatus = requiredElement<HTMLElement>('#source-status');
const toast = requiredElement<HTMLElement>('#toast');
const mobileMapButton = requiredElement<HTMLButtonElement>('#mobile-map-button');
const mapPanel = requiredElement<HTMLElement>('#map-panel');

const filters: FilterState = { query: '', media: 'all', country: 'all' };
const favorites = loadFavorites();
let catalog: CameraCatalog | null = null;
let filteredCameras: Camera[] = [];
let visibleLimit = 60;
let selectedCameraId: string | null = null;
let distanceOrigin: { latitude: number; longitude: number } | null = null;
let hlsPlayer: { destroy: () => void } | null = null;
let toastTimer: number | undefined;
let focusBeforeDetail: HTMLElement | null = null;

const map: LeafletMap = L.map('map', {
  center: [28, 4],
  zoom: 3,
  minZoom: 2,
  maxZoom: 18,
  worldCopyJump: true,
  preferCanvas: true,
  zoomControl: false,
});

L.control.zoom({ position: 'bottomright' }).addTo(map);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  noWrap: true,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const markerByCamera = new Map<string, CircleMarker>();
const canvasRenderer = L.canvas({ padding: 0.35 });
let userMarker: CircleMarker | null = null;

function loadFavorites(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('open-livecam:favorites') ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveFavorites(): void {
  localStorage.setItem('open-livecam:favorites', JSON.stringify([...favorites]));
}

function mediaLabel(camera: Camera): string {
  if (camera.media.kind === 'hls') return 'HLS配信';
  if (camera.media.kind === 'image') return '更新画像';
  return '公式一覧';
}

function categoryLabel(camera: Camera): string {
  const labels = {
    traffic: '道路',
    weather: '気象',
    city: '街・観光',
    nature: '自然',
    portal: 'ディレクトリ',
  } as const;
  return labels[camera.category];
}

function mediaClass(camera: Camera): string {
  return camera.media.kind === 'hls' ? 'live' : camera.media.kind === 'image' ? 'image' : 'portal';
}

function cameraMarkerStyle(camera: Camera, selected = false): L.CircleMarkerOptions {
  const colors = { hls: '#c6ff4a', image: '#69e8d0', portal: '#ffbd70' } as const;
  return {
    renderer: canvasRenderer,
    radius: selected ? 9 : camera.media.kind === 'portal' ? 7 : 4.5,
    color: selected ? '#ffffff' : colors[camera.media.kind],
    weight: selected ? 3 : 1.5,
    fillColor: colors[camera.media.kind],
    fillOpacity: selected ? 1 : 0.76,
  };
}

function renderMarkers(): void {
  markerLayer.clearLayers();
  markerByCamera.clear();
  for (const camera of filteredCameras) {
    const marker = L.circleMarker(
      [camera.latitude, camera.longitude],
      cameraMarkerStyle(camera, camera.id === selectedCameraId),
    );
    marker.on('click', () => selectCamera(camera, false));
    marker.bindTooltip(camera.name, { direction: 'top', opacity: 0.95 });
    marker.addTo(markerLayer);
    markerByCamera.set(camera.id, marker);
  }
}

function createCameraCard(camera: Camera): HTMLElement {
  const card = document.createElement('article');
  card.className = `camera-card${camera.id === selectedCameraId ? ' is-selected' : ''}`;
  card.dataset.cameraId = camera.id;

  const selectButton = document.createElement('button');
  selectButton.className = 'camera-card-main';
  selectButton.type = 'button';
  selectButton.addEventListener('click', () => selectCamera(camera, true));

  const marker = document.createElement('span');
  marker.className = `camera-card-marker marker-${mediaClass(camera)}`;
  marker.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('span');
  copy.className = 'camera-card-copy';
  const location = document.createElement('span');
  location.className = 'camera-card-location';
  location.textContent = `${camera.countryCode} · ${camera.region}`;
  const title = document.createElement('strong');
  title.textContent = camera.name;
  const meta = document.createElement('span');
  meta.className = 'camera-card-meta';
  meta.textContent = `${mediaLabel(camera)} · ${camera.source.name}`;
  copy.append(location, title, meta);
  selectButton.append(marker, copy);

  const favoriteButton = document.createElement('button');
  favoriteButton.className = `favorite-button${favorites.has(camera.id) ? ' is-favorite' : ''}`;
  favoriteButton.type = 'button';
  favoriteButton.setAttribute(
    'aria-label',
    favorites.has(camera.id) ? `${camera.name}を保存から外す` : `${camera.name}を保存する`,
  );
  favoriteButton.textContent = favorites.has(camera.id) ? '★' : '☆';
  favoriteButton.addEventListener('click', () => toggleFavorite(camera.id));

  card.append(selectButton, favoriteButton);
  return card;
}

function renderList(): void {
  resultsElement.replaceChildren();
  const fragment = document.createDocumentFragment();
  for (const camera of filteredCameras.slice(0, visibleLimit)) fragment.append(createCameraCard(camera));

  if (!filteredCameras.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<span aria-hidden="true">◎</span><strong>一致する公開カメラがありません</strong><p>検索語やフィルターを変えてください。</p>';
    fragment.append(empty);
  }
  resultsElement.append(fragment);
  resultsElement.setAttribute('aria-busy', 'false');
  resultCount.textContent = filteredCameras.length.toLocaleString('ja-JP');
  loadMoreButton.hidden = visibleLimit >= filteredCameras.length;
  if (!loadMoreButton.hidden) {
    loadMoreButton.textContent = `さらに表示（残り ${(filteredCameras.length - visibleLimit).toLocaleString('ja-JP')} 件）`;
  }
}

function applyFilters(updateMap = true): void {
  if (!catalog) return;
  filteredCameras = filterCameras(catalog.cameras, filters, favorites);
  if (distanceOrigin) {
    filteredCameras = sortByDistance(filteredCameras, distanceOrigin.latitude, distanceOrigin.longitude);
  } else {
    filteredCameras = sortForDiscovery(filteredCameras);
  }
  visibleLimit = 60;
  renderList();
  if (updateMap) renderMarkers();
}

function toggleFavorite(cameraId: string): void {
  if (favorites.has(cameraId)) favorites.delete(cameraId);
  else favorites.add(cameraId);
  saveFavorites();
  applyFilters(false);
  if (selectedCameraId === cameraId && catalog) {
    const selected = catalog.cameras.find((camera) => camera.id === cameraId);
    if (selected) renderDetail(selected);
  }
}

function resetSelectedMarker(): void {
  if (!selectedCameraId || !catalog) return;
  const previous = catalog.cameras.find((camera) => camera.id === selectedCameraId);
  const marker = markerByCamera.get(selectedCameraId);
  if (previous && marker) marker.setStyle(cameraMarkerStyle(previous));
}

function selectCamera(camera: Camera, moveMap: boolean): void {
  if (!selectedCameraId) {
    focusBeforeDetail = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  resetSelectedMarker();
  selectedCameraId = camera.id;
  markerByCamera.get(camera.id)?.setStyle(cameraMarkerStyle(camera, true));
  if (moveMap) {
    const target: L.LatLngExpression = [camera.latitude, camera.longitude];
    const zoom = Math.max(map.getZoom(), 8);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setView(target, zoom);
    else map.flyTo(target, zoom, { duration: 0.7 });
  }
  renderDetail(camera);
  renderList();
  const url = new URL(window.location.href);
  url.searchParams.set('camera', camera.id);
  history.replaceState(null, '', url);
  window.requestAnimationFrame(() => requiredElement<HTMLButtonElement>('#detail-close').focus());
}

function destroyMedia(): void {
  hlsPlayer?.destroy();
  hlsPlayer = null;
  const video = detailContent.querySelector<HTMLVideoElement>('video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
}

function closeDetail(): void {
  const returnFocus = focusBeforeDetail;
  const returnCameraId = selectedCameraId;
  destroyMedia();
  resetSelectedMarker();
  selectedCameraId = null;
  detailPanel.classList.remove('is-open');
  detailPanel.setAttribute('aria-hidden', 'true');
  detailPanel.inert = true;
  const url = new URL(window.location.href);
  url.searchParams.delete('camera');
  history.replaceState(null, '', url);
  renderList();
  focusBeforeDetail = null;
  const returnCard = [...document.querySelectorAll<HTMLElement>('.camera-card')].find(
    (card) => card.dataset.cameraId === returnCameraId,
  );
  const returnButton = returnCard?.querySelector<HTMLButtonElement>('.camera-card-main');
  if (returnButton) returnButton.focus();
  else if (returnFocus?.isConnected) returnFocus.focus();
  else map.getContainer().focus();
}

function formatObservedAt(value?: string): string | null {
  if (!value) return null;
  if (!value.endsWith('Z')) return `${value.replace('T', ' ')}（公開元の現地時刻）`;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}

function appendExternalLink(parent: HTMLElement, label: string, url: string, className = ''): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.className = className;
  link.textContent = label;
  parent.append(link);
  return link;
}

function renderDetail(camera: Camera): void {
  destroyMedia();
  detailContent.replaceChildren();
  detailPanel.classList.add('is-open');
  detailPanel.setAttribute('aria-hidden', 'false');
  detailPanel.inert = false;

  const header = document.createElement('div');
  header.className = 'detail-header';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'detail-eyebrow';
  eyebrow.textContent = `${camera.countryCode} / ${categoryLabel(camera)}`;
  const title = document.createElement('h2');
  title.textContent = camera.name;
  const region = document.createElement('p');
  region.className = 'detail-region';
  region.textContent = camera.region;
  header.append(eyebrow, title, region);

  const tags = document.createElement('div');
  tags.className = 'detail-tags';
  const mediaTag = document.createElement('span');
  mediaTag.className = `media-tag tag-${mediaClass(camera)}`;
  mediaTag.textContent = mediaLabel(camera);
  const categoryTag = document.createElement('span');
  categoryTag.textContent = categoryLabel(camera);
  tags.append(mediaTag, categoryTag);
  if (camera.direction) {
    const directionTag = document.createElement('span');
    directionTag.textContent = `方角: ${camera.direction}`;
    tags.append(directionTag);
  }

  const media = document.createElement('div');
  media.className = `media-frame media-${camera.media.kind}`;
  const mediaPlaceholder = document.createElement('div');
  mediaPlaceholder.className = 'media-placeholder';
  const scan = document.createElement('span');
  scan.className = 'scan-icon';
  scan.setAttribute('aria-hidden', 'true');
  scan.textContent = camera.media.kind === 'portal' ? '↗' : '◉';
  const mediaHeading = document.createElement('strong');
  mediaHeading.textContent = camera.media.kind === 'portal' ? '公式サイトでカメラを選択' : '外部メディアは未読込です';
  const mediaCopy = document.createElement('p');
  mediaCopy.textContent =
    camera.media.kind === 'portal'
      ? '公開元の一覧を新しいタブで開きます。'
      : `${camera.source.name} へ接続して現在の映像を取得します。`;
  mediaPlaceholder.append(scan, mediaHeading, mediaCopy);

  if (camera.media.kind === 'portal') {
    appendExternalLink(mediaPlaceholder, '公式一覧を開く ↗', camera.source.url, 'load-media-button');
  } else {
    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.className = 'load-media-button';
    loadButton.textContent = camera.media.kind === 'hls' ? 'HLS配信を読み込む' : '最新画像を読み込む';
    loadButton.addEventListener('click', () => void loadMedia(camera, media));
    mediaPlaceholder.append(loadButton);
  }
  media.append(mediaPlaceholder);

  const privacyNote = document.createElement('p');
  privacyNote.className = 'privacy-note';
  privacyNote.innerHTML = '<span aria-hidden="true">◈</span> 映像は公開元から直接取得されます。このサイトは録画・解析しません。';

  const facts = document.createElement('dl');
  facts.className = 'detail-facts';
  const factItems: Array<[string, string]> = [
    ['公開元', camera.source.name],
    ['座標', `${camera.latitude.toFixed(4)}, ${camera.longitude.toFixed(4)}`],
  ];
  const observedAt = formatObservedAt(camera.observedAt);
  if (observedAt) factItems.push(['メタデータ更新', observedAt]);
  for (const [term, definition] of factItems) {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = definition;
    facts.append(dt, dd);
  }

  const attribution = document.createElement('p');
  attribution.className = 'attribution';
  attribution.textContent = camera.source.attribution;

  const actions = document.createElement('div');
  actions.className = 'detail-actions';
  appendExternalLink(actions, '公開元で確認 ↗', camera.source.url, 'primary-link');
  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'secondary-button';
  favoriteButton.textContent = favorites.has(camera.id) ? '★ 保存済み' : '☆ 保存する';
  favoriteButton.addEventListener('click', () => toggleFavorite(camera.id));
  const shareButton = document.createElement('button');
  shareButton.type = 'button';
  shareButton.className = 'secondary-button';
  shareButton.textContent = 'リンクを共有';
  shareButton.addEventListener('click', () => void shareCamera(camera));
  actions.append(favoriteButton, shareButton);

  const terms = document.createElement('p');
  terms.className = 'terms-links';
  if (camera.source.termsUrl) appendExternalLink(terms, '公開元の利用条件', camera.source.termsUrl);
  appendExternalLink(
    terms,
    '問題を報告',
    `https://github.com/hjosugi/livecam/issues/new?template=report.yml&title=${encodeURIComponent(`[Report] ${camera.name}`)}`,
  );

  detailContent.append(header, tags, media, privacyNote, facts, attribution, actions, terms);
}

async function loadMedia(camera: Camera, frame: HTMLElement): Promise<void> {
  frame.replaceChildren();
  if (camera.media.kind === 'image' && camera.media.imageUrl) {
    const image = document.createElement('img');
    image.src = camera.media.imageUrl;
    image.alt = `${camera.name}の公開カメラ画像`;
    image.referrerPolicy = 'strict-origin-when-cross-origin';
    image.addEventListener('error', () => showMediaError(frame, camera));
    frame.append(image);
    return;
  }

  if (camera.media.kind === 'hls' && camera.media.streamUrl) {
    const video = document.createElement('video');
    video.controls = true;
    video.playsInline = true;
    video.preload = 'metadata';
    if (camera.media.imageUrl) video.poster = camera.media.imageUrl;
    video.setAttribute('aria-label', `${camera.name}のHLS配信`);
    video.addEventListener('error', () => showMediaError(frame, camera));
    frame.append(video);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = camera.media.streamUrl;
    } else {
      let Hls: typeof import('hls.js')['default'];
      try {
        ({ default: Hls } = await import('hls.js'));
      } catch {
        showMediaError(frame, camera);
        return;
      }
      if (!frame.isConnected || selectedCameraId !== camera.id) return;
      if (!Hls.isSupported()) {
        showMediaError(frame, camera);
        return;
      }
      const player = new Hls({ enableWorker: true, lowLatencyMode: true });
      hlsPlayer = player;
      player.loadSource(camera.media.streamUrl);
      player.attachMedia(video);
      player.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) showMediaError(frame, camera);
      });
    }
  }
}

function showMediaError(frame: HTMLElement, camera: Camera): void {
  destroyMedia();
  frame.replaceChildren();
  const message = document.createElement('div');
  message.className = 'media-placeholder media-error';
  const title = document.createElement('strong');
  title.textContent = 'この配信は現在読み込めません';
  const copy = document.createElement('p');
  copy.textContent = '停止中、地域制限、公開元の設定変更などが考えられます。';
  message.append(title, copy);
  appendExternalLink(message, '公開元で確認 ↗', camera.source.url, 'load-media-button');
  frame.append(message);
}

async function shareCamera(camera: Camera): Promise<void> {
  const url = new URL(window.location.href);
  url.searchParams.set('camera', camera.id);
  try {
    if (navigator.share) {
      await navigator.share({ title: camera.name, text: `${camera.name} — Open LiveCam Atlas`, url: url.href });
    } else {
      await navigator.clipboard.writeText(url.href);
      showToast('リンクをコピーしました');
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    showToast('共有できませんでした');
  }
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
}

function locateUser(): void {
  if (!navigator.geolocation) {
    showToast('このブラウザは現在地取得に対応していません');
    return;
  }
  showToast('現在地を確認しています…');
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      distanceOrigin = { latitude: coords.latitude, longitude: coords.longitude };
      if (userMarker) userMarker.removeFrom(map);
      userMarker = L.circleMarker([coords.latitude, coords.longitude], {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#6ee7d2',
        fillOpacity: 1,
      }).addTo(map);
      userMarker.bindTooltip('現在地（保存・送信されません）');
      const target: L.LatLngExpression = [coords.latitude, coords.longitude];
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setView(target, 8);
      else map.flyTo(target, 8, { duration: 0.8 });
      applyFilters(false);
      showToast('現在地に近い順へ並べ替えました');
    },
    () => showToast('現在地を取得できませんでした'),
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
  );
}

function populateCountries(cameras: Camera[]): void {
  for (const country of countryOptions(cameras)) {
    const option = document.createElement('option');
    option.value = country.code;
    option.textContent = `${country.label} (${country.count.toLocaleString('ja-JP')})`;
    countrySelect.append(option);
  }
}

function wireEvents(): void {
  searchInput.addEventListener('input', () => {
    filters.query = searchInput.value;
    applyFilters();
  });
  countrySelect.addEventListener('change', () => {
    filters.country = countrySelect.value;
    applyFilters();
  });
  requiredElement('#media-filters').addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-media]');
    if (!button) return;
    filters.media = button.dataset.media as MediaFilter;
    document.querySelectorAll<HTMLButtonElement>('[data-media]').forEach((chip) => {
      const active = chip === button;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
  });
  requiredElement('#reset-filters').addEventListener('click', () => {
    filters.query = '';
    filters.media = 'all';
    filters.country = 'all';
    distanceOrigin = null;
    searchInput.value = '';
    countrySelect.value = 'all';
    document.querySelectorAll<HTMLButtonElement>('[data-media]').forEach((chip) => {
      const active = chip.dataset.media === 'all';
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    applyFilters();
  });
  loadMoreButton.addEventListener('click', () => {
    visibleLimit += 60;
    renderList();
  });
  requiredElement('#detail-close').addEventListener('click', closeDetail);
  requiredElement('#location-button').addEventListener('click', locateUser);
  requiredElement('#map-near-button').addEventListener('click', locateUser);
  mobileMapButton.addEventListener('click', () => {
    mapPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => map.invalidateSize(), 450);
  });
  document.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      searchInput.focus();
    }
    if (event.key === 'Escape' && selectedCameraId) closeDetail();
  });
}

async function loadCatalog(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/cameras.json`);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    catalog = validateCatalog(await response.json());
    populateCountries(catalog.cameras);
    const hlsCount = catalog.cameras.filter((camera) => camera.media.kind === 'hls').length;
    const imageCount = catalog.cameras.filter((camera) => camera.media.kind === 'image').length;
    const portalCount = catalog.cameras.filter((camera) => camera.media.kind === 'portal').length;
    requiredElement('#hls-count').textContent = hlsCount.toLocaleString('ja-JP');
    requiredElement('#image-count').textContent = imageCount.toLocaleString('ja-JP');
    requiredElement('#portal-count').textContent = portalCount.toLocaleString('ja-JP');
    sourceStatus.textContent = `${catalog.cameras.length.toLocaleString('ja-JP')}件 · 公式公開ソース`;
    applyFilters();

    const requestedCamera = new URL(window.location.href).searchParams.get('camera');
    if (requestedCamera) {
      const camera = catalog.cameras.find((item) => item.id === requestedCamera);
      if (camera) selectCamera(camera, true);
    }
  } catch (error) {
    console.error(error);
    sourceStatus.textContent = 'データを読み込めませんでした';
    resultsElement.setAttribute('aria-busy', 'false');
    resultsElement.innerHTML = '<div class="empty-state"><strong>カタログを読み込めませんでした</strong><p>接続を確認して再読み込みしてください。</p></div>';
  }
}

wireEvents();
void loadCatalog();
