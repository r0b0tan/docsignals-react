import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse, RequestOptions } from 'http';
import https from 'https';
import http from 'http';

const MAX_REDIRECTS = 5;

// Rate limiting for dev proxy
const RATE_LIMIT_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// SSRF protection - block private/local IPs (IPv4 + IPv6)
const BLOCKED_PATTERN = /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.0\.0\.0|\[::1\]|\[fe80:|\[fc[0-9a-f]{2}:|\[fd[0-9a-f]{2}:)/i;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true, retryAfter: 0 };
}

function proxyRequest(
  targetUrl: URL,
  res: ServerResponse,
  redirectCount: number
): void {
  if (redirectCount > MAX_REDIRECTS) {
    res.statusCode = 508;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Too many redirects — the URL redirects more than 5 times.');
    return;
  }

  const client = targetUrl.protocol === 'https:' ? https : http;

  const options: RequestOptions = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: 'GET',
    headers: {
      'Host': targetUrl.host,
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
    timeout: 25000, // 25 second timeout
  };

  const proxyReq = client.request(options, (proxyRes) => {
    const status = proxyRes.statusCode || 200;

    // Handle redirects
    if (status >= 300 && status < 400 && proxyRes.headers.location) {
      const location = proxyRes.headers.location;
      let nextUrl: URL;
      try {
        nextUrl = new URL(location, targetUrl);
      } catch {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Invalid redirect URL received from server.');
        return;
      }
      // Re-validate redirect target to prevent SSRF via open redirect
      if (!['http:', 'https:'].includes(nextUrl.protocol)) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Only HTTP(S) allowed');
        return;
      }
      if (BLOCKED_PATTERN.test(nextUrl.hostname)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Private addresses not allowed');
        return;
      }
      proxyRequest(nextUrl, res, redirectCount + 1);
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'text/html');
    res.statusCode = status;
    proxyRes.pipe(res);
  });

  proxyReq.on('timeout', () => {
    proxyReq.destroy();
    res.statusCode = 504;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Gateway timeout — the target server took too long to respond.');
  });

  proxyReq.on('error', (err) => {
    const errMsg = err.message.toLowerCase();
    
    if (errMsg.includes('enotfound') || errMsg.includes('getaddrinfo')) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Domain not found — the website does not exist or DNS lookup failed.');
      return;
    }
    
    if (errMsg.includes('econnrefused')) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Connection refused — the server is not accepting connections.');
      return;
    }
    
    if (errMsg.includes('econnreset')) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Connection reset — the server closed the connection unexpectedly.');
      return;
    }
    
    if (errMsg.includes('etimedout') || errMsg.includes('timeout')) {
      res.statusCode = 504;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Connection timed out — the server is not responding.');
      return;
    }

    if (errMsg.includes('cert') || errMsg.includes('ssl') || errMsg.includes('tls')) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/plain');
      res.end('SSL/TLS error — the website has certificate issues.');
      return;
    }

    console.error(`[Proxy] Unhandled error from ${targetUrl.hostname}:`, err.message);
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Proxy error — unable to retrieve the requested page.');
  });

  proxyReq.end();
}

export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [
    react(),
    {
      name: 'cors-proxy',
      configureServer(server) {
        server.middlewares.use('/proxy', (req: IncomingMessage, res: ServerResponse) => {
          // Rate limiting (use localhost for dev)
          const clientIp = req.socket.remoteAddress || '127.0.0.1';
          const rateCheck = checkRateLimit(clientIp);
          if (!rateCheck.allowed) {
            res.statusCode = 429;
            res.setHeader('Retry-After', String(rateCheck.retryAfter));
            res.end(`Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`);
            return;
          }

          const urlParam = new URL(req.url!, 'http://localhost').searchParams.get('url');
          if (!urlParam) {
            res.statusCode = 400;
            res.end('Missing url parameter');
            return;
          }

          let targetUrl: URL;
          try {
            targetUrl = new URL(urlParam);
          } catch {
            res.statusCode = 400;
            res.end('Invalid URL');
            return;
          }

          // Protocol check
          if (!['http:', 'https:'].includes(targetUrl.protocol)) {
            res.statusCode = 400;
            res.end('Only HTTP(S) allowed');
            return;
          }

          // SSRF protection
          if (BLOCKED_PATTERN.test(targetUrl.hostname)) {
            res.statusCode = 403;
            res.end('Private addresses not allowed');
            return;
          }

          proxyRequest(targetUrl, res, 0);
        });
      },
    },
  ],
}));
