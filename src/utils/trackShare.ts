export interface SocialShareParams {
  shareUrl: string;
  title: string;
  creator?: string;
}

export function buildTrackShareUrl(
  origin: string,
  pathname: string,
  trackId: string
): string {
  const cleanOrigin = (origin || '').replace(/\/+$/, '');
  const cleanPath = pathname && pathname.startsWith('/') ? pathname : `/${pathname || ''}`;
  const encodedId = encodeURIComponent((trackId || '').trim());
  if (!encodedId) {
    return `${cleanOrigin}${cleanPath}`;
  }
  return `${cleanOrigin}${cleanPath}?track=${encodedId}`;
}

export function buildTwitterShareUrl({ shareUrl, title, creator }: SocialShareParams): string {
  const cleanTitle = (title || 'this track').trim();
  const byCreator = creator?.trim() ? ` by ${creator.trim()}` : '';
  const text = `Listening to "${cleanTitle}"${byCreator} on AI Music Haven`;
  const params = new URLSearchParams({
    text,
    url: shareUrl,
  });
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

export function buildRedditShareUrl({ shareUrl, title, creator }: SocialShareParams): string {
  const cleanTitle = (title || 'Untitled AI Track').trim();
  const byCreator = creator?.trim() ? ` by ${creator.trim()}` : '';
  const postTitle = `${cleanTitle}${byCreator} — AI Music Haven`;
  const params = new URLSearchParams({
    url: shareUrl,
    title: postTitle,
  });
  return `https://www.reddit.com/submit?${params.toString()}`;
}

export function buildDiscordShareMessage({ shareUrl, title, creator }: SocialShareParams): string {
  const cleanTitle = (title || 'Untitled AI Track').trim();
  const byCreator = creator?.trim() ? ` by **${creator.trim()}**` : '';
  return `Listening to **"${cleanTitle}"**${byCreator} on AI Music Haven:\n${shareUrl}`;
}

export function parseTrackIdFromSearch(search: string): string | null {
  if (!search) return null;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const raw = params.get('track');
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand if clipboard API permission is denied
    }
  }

  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }

  return false;
}
