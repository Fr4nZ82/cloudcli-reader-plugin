// Plugin backend subprocess.
// Spawned by CloudCLI as `node dist/server.js`. Must print a single JSON
// handshake line to stdout: {"ready":true,"port":<port>}.
// Requests from the frontend arrive via api.rpc(method, path, body) which
// the host proxies to this server. Auth headers are stripped before proxy.

import http from 'node:http';
import type { AddressInfo } from 'node:net';

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/ping') {
      sendJson(res, 200, { ok: true, message: 'pong', at: new Date().toISOString() });
      return;
    }

    sendJson(res, 404, { error: 'not_found', path: req.url });
  } catch (err) {
    sendJson(res, 500, { error: 'internal', message: (err as Error).message });
  }
});

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

server.listen(0, '127.0.0.1', () => {
  const port = (server.address() as AddressInfo).port;
  // Handshake — required for the host to know we are ready and which port to proxy to.
  process.stdout.write(JSON.stringify({ ready: true, port }) + '\n');
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
