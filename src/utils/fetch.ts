export interface FetchResult {
  html: string | null;
  error: string | null;
  url: string;
}

export async function fetchHtml(url: string): Promise<FetchResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return {
        html: null,
        error: `HTTP ${response.status}: ${response.statusText}`,
        url,
      };
    }
    const html = await response.text();
    return { html, error: null, url };
  } catch (error) {
    // Handle CORS and network errors
    const message =
      error instanceof TypeError && error.message === 'Failed to fetch'
        ? 'CORS policy blocked this request. The server does not allow cross-origin requests from the browser.'
        : error instanceof Error
          ? error.message
          : 'Unknown network error';
    
    console.warn(`[fetchHtml] Failed to fetch ${url}:`, message);
    return { html: null, error: message, url };
  }
}
