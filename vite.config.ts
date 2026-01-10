import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse, RequestOptions } from 'http';
import https from 'https';
import http from 'http';

const MAX_REDIRECTS = 5;

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
      'User-Agent': 'DocSignals/1.0 (https://docsignals.dev)',
      'Accept': 'text/html,application/xhtml+xml,*/*',
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

    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain');
    res.end(`Proxy error: ${err.message}`);
  });

  proxyReq.end();
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'cors-proxy',
      configureServer(server) {
        server.middlewares.use('/proxy', (req: IncomingMessage, res: ServerResponse) => {
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

          proxyRequest(targetUrl, res, 0);
        });
      },
    },
  ],
});
