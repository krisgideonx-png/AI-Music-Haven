export const DEFAULT_CLOUD_RUN_API_URL =
  'https://ai-music-haven-287128902590.europe-west3.run.app';

export interface ApiUrlOptions {
  envApiBaseUrl?: string;
  hostname?: string;
}

export function isStaticHostingOrigin(hostname?: string): boolean {
  const clean = (hostname || '').trim().toLowerCase();
  if (!clean) return false;
  return clean.endsWith('.github.io');
}

function readMetaEnvApiUrl(): string {
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    return (meta?.env?.VITE_API_BASE_URL || '').trim();
  } catch {
    return '';
  }
}

export function resolveApiBaseUrl(options?: ApiUrlOptions): string {
  const rawEnv =
    options?.envApiBaseUrl !== undefined ? options.envApiBaseUrl : readMetaEnvApiUrl();
  const cleanEnv = (rawEnv || '').trim().replace(/\/+$/, '');

  const hostname =
    options?.hostname !== undefined
      ? options.hostname
      : typeof window !== 'undefined'
      ? window.location.hostname
      : '';

  if (isStaticHostingOrigin(hostname)) {
    return cleanEnv || DEFAULT_CLOUD_RUN_API_URL;
  }

  // Same-origin relative paths on Cloud Run, AI Studio preview, and localhost
  return '';
}

export function buildApiUrl(path: string, options?: ApiUrlOptions): string {
  const trimmed = (path || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const baseUrl = resolveApiBaseUrl(options);
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
