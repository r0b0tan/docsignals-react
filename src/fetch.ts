const BLOCKED_PATTERN =
  /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\])/i;

export function validateUrl(
  input: string
): { ok: true; url: string } | { ok: false, error: string } {
  let url: URL;
  try {
    url = new URL(input.includes('://') ? input : `https://${input}`);
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'HTTP(S) only' };
  }

  if (BLOCKED_PATTERN.test(url.hostname)) {
    return { ok: false, error: 'Cannot analyze local/private addresses' };
  }

  return { ok: true, url: url.href };
}

export interface FetchResult {
  html: string | null;
  error: string | null;
  errorType?: 'network' | 'http' | 'cors' | 'timeout' | 'invalid' | 'empty' | 'unknown';
  url: string;
}

export async function fetchHtml(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    // Use the proxy to avoid CORS issues
    const proxyUrl = `/proxy?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,*/*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const { message, errorType } = getHttpErrorMessage(response.status, response.statusText);
      return { html: null, error: message, errorType, url };
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
      return {
        html: null,
        error: `Invalid content type: ${contentType}. Expected HTML.`,
        errorType: 'invalid',
        url,
      };
    }

    const html = await response.text();

    if (!html || html.trim().length === 0) {
      return {
        html: null,
        error: 'Server returned an empty response.',
        errorType: 'empty',
        url,
      };
    }

    // Basic check if it looks like HTML
    if (!html.includes('<') || !html.includes('>')) {
      return {
        html: null,
        error: 'Response does not appear to be valid HTML.',
        errorType: 'invalid',
        url,
      };
    }

    return { html, error: null, url };
  } catch (error) {
    clearTimeout(timeoutId);
    const { message, errorType } = getNetworkErrorMessage(error);
    console.warn(`[fetchHtml] Failed to fetch ${url}:`, message);
    return { html: null, error: message, errorType, url };
  }
}

function getHttpErrorMessage(status: number, statusText: string): { message: string; errorType: FetchResult['errorType'] } {
  switch (status) {
    case 400:
      return { message: 'Bad request (400) — the URL may be malformed.', errorType: 'http' };
    case 401:
      return { message: 'Authentication required (401) — this page requires login.', errorType: 'http' };
    case 403:
      return { message: 'Access forbidden (403) — you don\'t have permission to view this page.', errorType: 'http' };
    case 404:
      return { message: 'Page not found (404) — this URL does not exist.', errorType: 'http' };
    case 405:
      return { message: 'Method not allowed (405) — the server rejected the request.', errorType: 'http' };
    case 408:
      return { message: 'Request timeout (408) — the server took too long to respond.', errorType: 'timeout' };
    case 410:
      return { message: 'Page gone (410) — this content has been permanently removed.', errorType: 'http' };
    case 429:
      return { message: 'Too many requests (429) — rate limited. Try again later.', errorType: 'http' };
    case 500:
      return { message: 'Server error (500) — the website encountered an internal error.', errorType: 'http' };
    case 502:
      return { message: 'Bad gateway (502) — the server may be down or unreachable.', errorType: 'http' };
    case 503:
      return { message: 'Service unavailable (503) — the website is temporarily offline.', errorType: 'http' };
    case 504:
      return { message: 'Gateway timeout (504) — the server took too long to respond.', errorType: 'timeout' };
    case 520:
    case 521:
    case 522:
    case 523:
    case 524:
      return { message: `Cloudflare error (${status}) — the origin server is unreachable.`, errorType: 'http' };
    default:
      return { message: `HTTP error ${status}: ${statusText}`, errorType: 'http' };
  }
}

function getNetworkErrorMessage(error: unknown): { message: string; errorType: FetchResult['errorType'] } {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { 
      message: 'Request timed out — the server took too long to respond (30s limit).', 
      errorType: 'timeout' 
    };
  }

  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    
    if (msg === 'failed to fetch') {
      return { 
        message: 'Unable to connect — the server may be down, blocking requests, or there\'s a network issue.', 
        errorType: 'network' 
      };
    }
    
    if (msg.includes('network') || msg.includes('internet')) {
      return { 
        message: 'Network error — please check your internet connection.', 
        errorType: 'network' 
      };
    }
    
    if (msg.includes('cors')) {
      return { 
        message: 'CORS blocked — the server does not allow cross-origin requests.', 
        errorType: 'cors' 
      };
    }

    if (msg.includes('ssl') || msg.includes('certificate') || msg.includes('tls')) {
      return { 
        message: 'SSL/TLS error — the website has certificate issues.', 
        errorType: 'network' 
      };
    }

    return { message: error.message, errorType: 'unknown' };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('timeout')) {
      return { 
        message: 'Request timed out — the server took too long to respond.', 
        errorType: 'timeout' 
      };
    }
    
    if (msg.includes('redirect') && msg.includes('loop')) {
      return { 
        message: 'Redirect loop detected — the URL redirects in a circle.', 
        errorType: 'network' 
      };
    }

    if (msg.includes('too many redirect')) {
      return { 
        message: 'Too many redirects — the URL redirects too many times.', 
        errorType: 'network' 
      };
    }

    return { message: error.message, errorType: 'unknown' };
  }

  return { message: 'An unknown error occurred.', errorType: 'unknown' };
}
