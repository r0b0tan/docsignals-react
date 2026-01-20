/**
 * DocSignals Proxy Worker
 *
 * Security features:
 * - API Key authentication (X-Proxy-Key header)
 * - IP-based rate limiting (10 requests per 60 seconds)
 * - SSRF protection (blocks private/local IPs)
 *
 * Deploy: wrangler deploy
 * Set secret: wrangler secret put PROXY_API_KEY
 */

// Rate limiting config
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;

// In-memory rate limit store (resets on cold start, fine for basic protection)
const rateLimitMap = new Map();

// SSRF protection - block private/local IPs (IPv4 + IPv6)
const BLOCKED_PATTERN = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\]|\[fe80:|\[fc[0-9a-f]{2}:|\[fd[0-9a-f]{2}:)/i;

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://docsignals.christophbauer.dev',
  'http://localhost:5173',
  'http://localhost:4173',
];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : null;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(new Response(null, { status: 204 }), allowedOrigin);
    }

    // Block requests from unknown origins (except direct requests without Origin header)
    if (origin && !allowedOrigin) {
      return new Response('Forbidden', { status: 403 });
    }

    // Check API key
    const apiKey = request.headers.get('X-Proxy-Key');
    if (!apiKey || apiKey !== env.PROXY_API_KEY) {
      return corsResponse(new Response('Unauthorized', { status: 401 }), allowedOrigin);
    }

    // Rate limiting by IP
    const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return corsResponse(new Response(
        `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`,
        {
          status: 429,
          headers: { 'Retry-After': String(rateCheck.retryAfter) }
        }
      ), allowedOrigin);
    }

    // Get target URL
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return corsResponse(new Response('Missing url parameter', { status: 400 }), allowedOrigin);
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return corsResponse(new Response('Invalid URL', { status: 400 }), allowedOrigin);
    }

    // Protocol check
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return corsResponse(new Response('Only HTTP(S) allowed', { status: 400 }), allowedOrigin);
    }

    // SSRF protection
    if (BLOCKED_PATTERN.test(parsedUrl.hostname)) {
      return corsResponse(new Response('Private addresses not allowed', { status: 403 }), allowedOrigin);
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      const body = await response.text();

      return corsResponse(new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'text/html',
        },
      }), allowedOrigin);
    } catch (err) {
      return corsResponse(new Response('Proxy error', { status: 502 }), allowedOrigin);
    }
  },
};

function checkRateLimit(clientIp) {
  const now = Date.now();
  const windowMs = RATE_LIMIT_WINDOW_SECONDS * 1000;

  let entry = rateLimitMap.get(clientIp);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitMap.set(clientIp, entry);
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_REQUESTS) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}

function corsResponse(response, origin) {
  const headers = new Headers(response.headers);
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'X-Proxy-Key');
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
