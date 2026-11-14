import type { AudioTrack } from '../types/index.ts';

export interface ShareMetadata {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  imageType?: string;
  imageWidth?: string;
  imageHeight?: string;
  imageAlt: string;
  ogType: 'website' | 'music.song';
  siteName: string;
}

export const DEFAULT_SITE_NAME = 'AI Music Haven';
export const DEFAULT_TITLE = 'AI Music Haven — Where AI Music Finds Its Home';
export const DEFAULT_DESCRIPTION =
  'Discover, listen to, upload, and share extraordinary AI-generated music from creators worldwide on AI Music Haven.';
export const DEFAULT_OG_IMAGE_PATH = '/og-image.jpg';
export const DEFAULT_OG_IMAGE_WIDTH = '1376';
export const DEFAULT_OG_IMAGE_HEIGHT = '768';

export function escapeHtmlAttr(value: string): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function resolveRequestOrigin(params: {
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
  appUrl?: string;
}): string {
  const rawForwardedHost = params.headers?.['x-forwarded-host'];
  const rawHost = params.headers?.host;
  const hostValue = Array.isArray(rawForwardedHost)
    ? rawForwardedHost[0]
    : rawForwardedHost || (Array.isArray(rawHost) ? rawHost[0] : rawHost);
  const host = (hostValue || '').split(',')[0].trim();

  if (host) {
    const rawProto = params.headers?.['x-forwarded-proto'];
    const protoHeader = (Array.isArray(rawProto) ? rawProto[0] : rawProto || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const isLocalHost =
      host.startsWith('localhost') ||
      host.startsWith('127.0.0.1') ||
      host.startsWith('0.0.0.0');
    const proto = protoHeader || (isLocalHost ? params.protocol || 'http' : 'https');
    return `${proto}://${host}`;
  }

  if (params.appUrl && /^https?:\/\//i.test(params.appUrl.trim())) {
    return params.appUrl.trim().replace(/\/+$/, '');
  }

  return 'https://krisgideonx-png.github.io';
}

export function isRasterShareImageUrl(url?: string | null): boolean {
  const trimmed = (url || '').trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  const withoutQuery = trimmed.split(/[?#]/)[0].toLowerCase();
  if (withoutQuery.endsWith('.svg')) return false;
  return true;
}

export function normalizeTrackOgImageUrl(coverArt?: string | null): string | null {
  if (!isRasterShareImageUrl(coverArt)) return null;
  const trimmed = coverArt!.trim();
  // Upgrade Unsplash thumbnails to 1200x630 JPEG banner dimensions so Twitterbot/X never receives WebP under image/jpeg
  if (trimmed.includes('images.unsplash.com/')) {
    try {
      const parsed = new URL(trimmed);
      parsed.searchParams.delete('auto');
      parsed.searchParams.set('fm', 'jpg');
      parsed.searchParams.set('w', '1200');
      parsed.searchParams.set('h', '630');
      parsed.searchParams.set('fit', 'crop');
      parsed.searchParams.set('q', '85');
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function resolveShareMetadata(params: {
  origin: string;
  pathname?: string;
  track?: Partial<AudioTrack> | null;
}): ShareMetadata {
  const cleanOrigin = (params.origin || '').replace(/\/+$/, '');
  const cleanPath =
    params.pathname && params.pathname.startsWith('/')
      ? params.pathname
      : `/${params.pathname || ''}`;

  const defaultImageUrl = `${cleanOrigin}${DEFAULT_OG_IMAGE_PATH}`;
  const track = params.track;

  if (!track || !track.id || !track.title) {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: `${cleanOrigin}${cleanPath}`,
      imageUrl: defaultImageUrl,
      imageType: 'image/jpeg',
      imageWidth: DEFAULT_OG_IMAGE_WIDTH,
      imageHeight: DEFAULT_OG_IMAGE_HEIGHT,
      imageAlt: DEFAULT_TITLE,
      ogType: 'website',
      siteName: DEFAULT_SITE_NAME,
    };
  }

  const creatorLabel = track.creator ? ` by ${track.creator}` : '';
  const title = `${track.title}${creatorLabel} — ${DEFAULT_SITE_NAME}`;
  const detailsPrefix = [track.genre, track.bpm ? `${track.bpm} BPM` : '', track.aiToolOrigin]
    .filter(Boolean)
    .join(' · ');
  const combinedDesc = [detailsPrefix, track.description].filter(Boolean).join('. ');
  const description = (combinedDesc || DEFAULT_DESCRIPTION).slice(0, 200);
  const trackImage = normalizeTrackOgImageUrl(track.coverArt);
  const usingDefaultBanner = !trackImage;

  return {
    title,
    description,
    url: `${cleanOrigin}${cleanPath}?track=${encodeURIComponent(track.id)}`,
    imageUrl: trackImage || defaultImageUrl,
    imageType: 'image/jpeg',
    imageWidth: usingDefaultBanner ? DEFAULT_OG_IMAGE_WIDTH : '1200',
    imageHeight: usingDefaultBanner ? DEFAULT_OG_IMAGE_HEIGHT : '630',
    imageAlt: `${track.title}${creatorLabel} cover art on ${DEFAULT_SITE_NAME}`,
    ogType: 'music.song',
    siteName: DEFAULT_SITE_NAME,
  };
}

function upsertMetaTag(
  html: string,
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): string {
  const escapedContent = escapeHtmlAttr(content);
  const tag = `<meta ${attrName}="${attrValue}" content="${escapedContent}" />`;
  const regex = new RegExp(
    `<meta\\s+[^>]*${attrName}=["']${attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`,
    'i'
  );
  if (regex.test(html)) {
    return html.replace(regex, () => tag);
  }
  return html.replace(/<\/head>/i, () => `    ${tag}\n  </head>`);
}

function upsertCanonicalLink(html: string, href: string): string {
  const escapedHref = escapeHtmlAttr(href);
  const tag = `<link rel="canonical" href="${escapedHref}" />`;
  const regex = /<link\s+[^>]*rel=["']canonical["'][^>]*>/i;
  if (regex.test(html)) {
    return html.replace(regex, () => tag);
  }
  return html.replace(/<\/head>/i, () => `    ${tag}\n  </head>`);
}

export function injectOpenGraphMeta(html: string, meta: ShareMetadata): string {
  let out = html;

  out = out.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtmlAttr(meta.title)}</title>`);
  out = upsertCanonicalLink(out, meta.url);
  out = upsertMetaTag(out, 'name', 'description', meta.description);

  out = upsertMetaTag(out, 'property', 'og:site_name', meta.siteName);
  out = upsertMetaTag(out, 'property', 'og:type', meta.ogType);
  out = upsertMetaTag(out, 'property', 'og:url', meta.url);
  out = upsertMetaTag(out, 'property', 'og:title', meta.title);
  out = upsertMetaTag(out, 'property', 'og:description', meta.description);
  out = upsertMetaTag(out, 'property', 'og:image', meta.imageUrl);
  out = upsertMetaTag(out, 'property', 'og:image:secure_url', meta.imageUrl);
  if (meta.imageType) {
    out = upsertMetaTag(out, 'property', 'og:image:type', meta.imageType);
  }
  if (meta.imageWidth) {
    out = upsertMetaTag(out, 'property', 'og:image:width', meta.imageWidth);
  }
  if (meta.imageHeight) {
    out = upsertMetaTag(out, 'property', 'og:image:height', meta.imageHeight);
  }
  out = upsertMetaTag(out, 'property', 'og:image:alt', meta.imageAlt);

  out = upsertMetaTag(out, 'name', 'twitter:card', 'summary_large_image');
  out = upsertMetaTag(out, 'name', 'twitter:url', meta.url);
  out = upsertMetaTag(out, 'name', 'twitter:title', meta.title);
  out = upsertMetaTag(out, 'name', 'twitter:description', meta.description);
  out = upsertMetaTag(out, 'name', 'twitter:image', meta.imageUrl);
  out = upsertMetaTag(out, 'name', 'twitter:image:alt', meta.imageAlt);

  return out;
}
