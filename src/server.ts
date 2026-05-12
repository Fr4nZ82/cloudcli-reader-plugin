// Plugin backend subprocess.
// Spawned by CloudCLI as `node dist/server.js`. Must print a single JSON
// handshake line to stdout: {"ready":true,"port":<port>}.
// Requests from the frontend arrive via api.rpc(method, path, body) which
// the host proxies to this server. Auth headers are stripped before proxy.

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const SKIP_DIRS = new Set([
  '.git', '.svn', '.hg',
  'node_modules', '.pnpm-store',
  '.next', '.nuxt', '.cache', '.parcel-cache',
  'dist', 'build', 'out', 'target',
  '.venv', 'venv', '__pycache__',
  '.idea', '.vscode',
]);

const MAX_FILES = 5000;
const MAX_DEPTH = 12;
const MAX_BODY = 10 * 1024 * 1024;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';

    if (method === 'GET' && url.pathname === '/ping') {
      sendJson(res, 200, { ok: true, message: 'pong', at: new Date().toISOString() });
      return;
    }

    if (method === 'GET' && url.pathname === '/files') {
      const project = url.searchParams.get('project');
      if (!project) { sendJson(res, 400, { error: 'missing_param', param: 'project' }); return; }
      try {
        const files = await listMarkdownFiles(project);
        sendJson(res, 200, { files });
      } catch (err) {
        sendJson(res, 500, { error: 'list_failed', message: (err as Error).message });
      }
      return;
    }

    if (method === 'GET' && url.pathname === '/file') {
      const project = url.searchParams.get('project');
      const rel = url.searchParams.get('path');
      if (!project || !rel) { sendJson(res, 400, { error: 'missing_param', params: ['project', 'path'] }); return; }
      const abs = safeJoin(project, rel);
      if (!abs) { sendJson(res, 403, { error: 'path_outside_project' }); return; }
      try {
        const content = await fs.readFile(abs, 'utf-8');
        sendJson(res, 200, { content, path: rel });
      } catch (err) {
        sendJson(res, 404, { error: 'read_failed', message: (err as Error).message });
      }
      return;
    }

    if (method === 'POST' && url.pathname === '/file') {
      const project = url.searchParams.get('project');
      const rel = url.searchParams.get('path');
      if (!project || !rel) { sendJson(res, 400, { error: 'missing_param', params: ['project', 'path'] }); return; }
      const abs = safeJoin(project, rel);
      if (!abs) { sendJson(res, 403, { error: 'path_outside_project' }); return; }
      try {
        const body = await readBody(req);
        if (!body || typeof body.content !== 'string') {
          sendJson(res, 400, { error: 'missing_field', field: 'content' });
          return;
        }
        await fs.writeFile(abs, body.content, 'utf-8');
        sendJson(res, 200, { ok: true, path: rel, bytes: Buffer.byteLength(body.content, 'utf-8') });
      } catch (err) {
        sendJson(res, 500, { error: 'write_failed', message: (err as Error).message });
      }
      return;
    }

    sendJson(res, 404, { error: 'not_found', method, path: url.pathname });
  } catch (err) {
    sendJson(res, 500, { error: 'internal', message: (err as Error).message });
  }
});

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    total += chunk.length;
    if (total > MAX_BODY) throw new Error('body too large');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  if (!raw) return null;
  return JSON.parse(raw);
}

function safeJoin(project: string, rel: string): string | null {
  const absProject = path.resolve(project);
  const absTarget = path.resolve(absProject, rel);
  if (absTarget !== absProject && !absTarget.startsWith(absProject + path.sep)) {
    return null;
  }
  return absTarget;
}

async function listMarkdownFiles(root: string): Promise<string[]> {
  const absRoot = path.resolve(root);
  const results: string[] = [];

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH) return;
    if (results.length >= MAX_FILES) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (results.length >= MAX_FILES) return;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.mdx')) {
          results.push(path.relative(absRoot, full).split(path.sep).join('/'));
        }
      }
    }
  }

  await walk(absRoot, 0);
  results.sort();
  return results;
}

server.listen(0, '127.0.0.1', () => {
  const port = (server.address() as AddressInfo).port;
  process.stdout.write(JSON.stringify({ ready: true, port }) + '\n');
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
