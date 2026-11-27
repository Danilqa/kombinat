import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream';
import zlib from 'node:zlib';

import { getErrorMessage } from 'utils/error';

import { fail } from './api/response';
import type { ApiContext, ApiResponse } from './api/response';
import { routeApi } from './api/routes';
import { config } from './config';
import { deleteExpiredRuns, startCleanup } from './domains/run/retention';
import { deleteExpiredWebhookCalls } from './domains/webhook/call-log';
import { startLiveUpdates } from './features/live-updates/live-updates';
import { startCpuSampling } from './features/machine-usage/machine-usage';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const GZIPPED_EXTENSIONS = new Set(['.html', '.js', '.css', '.svg', '.json', '.webmanifest']);

const MAX_BODY_KB = 256;

function sendJson(res: http.ServerResponse, { status, body }: ApiResponse): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  if (!fs.existsSync(config.webAppDist)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('kombinat API is up. Run `pnpm build` to get the dashboard here.\n');
    return;
  }
  const requested = path.normalize(decodeURIComponent(url.pathname));
  const candidate = path.join(config.webAppDist, requested);
  const isFile =
    candidate.startsWith(config.webAppDist) &&
    fs.existsSync(candidate) &&
    fs.statSync(candidate).isFile();
  const file = isFile ? candidate : path.join(config.webAppDist, 'index.html');
  const extension = path.extname(file);
  const isHashed = path.dirname(file) === path.join(config.webAppDist, 'assets');
  const isGzipped =
    GZIPPED_EXTENSIONS.has(extension) && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (isGzipped) res.setHeader('content-encoding', 'gzip');
  res.writeHead(200, {
    'content-type': MIME[extension] ?? 'application/octet-stream',
    'cache-control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    vary: 'accept-encoding',
  });
  const content = fs.createReadStream(file);
  pipeline(isGzipped ? [content, zlib.createGzip(), res] : [content, res], () => undefined);
}

// There is no login, so pages from other sites must not start runs through the browser.
export function checkIsCrossSite(headers: http.IncomingHttpHeaders): boolean {
  const site = headers['sec-fetch-site'];
  if (site !== undefined) return site !== 'same-origin' && site !== 'none';
  return headers.origin !== undefined && URL.parse(headers.origin)?.host !== headers.host;
}

// Read to the end anyway, so the client gets the 413.
function readBody(req: http.IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size <= MAX_BODY_KB * 1024) chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(size > MAX_BODY_KB * 1024 ? null : Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

async function handleApi(
  req: http.IncomingMessage,
  segments: string[],
  context: Omit<ApiContext, 'request'>,
): Promise<ApiResponse> {
  const method = req.method ?? 'GET';
  const { headers } = req;
  if (method === 'GET') {
    return routeApi([method, segments], {
      ...context,
      request: { body: Buffer.alloc(0), headers },
    });
  }
  if (checkIsCrossSite(headers)) {
    return fail(403, 'Requests from other sites cannot change anything');
  }
  const body = await readBody(req);
  if (body === null) return fail(413, `The request body is larger than ${MAX_BODY_KB} KB`);
  return routeApi([method, segments], { ...context, request: { body, headers } });
}

export function startServer(log: (line: string) => void): http.Server {
  const startedAt = new Date();
  const liveUpdates = startLiveUpdates();
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${config.port}`);
    const [root, ...segments] = url.pathname.split('/').filter(Boolean);
    const respond = async (): Promise<void> => {
      if (root !== 'api') serveStatic(req, res, url);
      else if (req.method === 'GET' && url.pathname === '/api/events') liveUpdates.follow(req, res);
      else sendJson(res, await handleApi(req, segments, { url, startedAt, log }));
    };
    respond().catch((error: unknown) => {
      const message = getErrorMessage(error);
      log(`request failed ${url.pathname}: ${message}`);
      sendJson(res, fail(500, message));
    });
  });
  server.on('close', startCpuSampling());
  server.on(
    'close',
    startCleanup(log, [
      { items: 'runs', deleteExpired: deleteExpiredRuns },
      { items: 'webhook calls', deleteExpired: deleteExpiredWebhookCalls },
    ]),
  );
  server.on('close', liveUpdates.stop);
  server.listen(config.port, '127.0.0.1', () => {
    log(`ui at http://localhost:${config.port}`);
  });
  return server;
}
