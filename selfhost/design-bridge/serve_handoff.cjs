#!/usr/bin/env node
/*
 * serve_handoff.cjs — clean-room replacement for the AD5X Design bridge.
 *
 * The Windows RC1 package bundles a Design bridge executable script with
 * this exact invocation (src/slic3r/GUI/MainFrame.cpp):
 *
 *   node serve_handoff.cjs <wwwDir> 18195 <spoolDir>
 *
 * It serves the built Design web app on http://127.0.0.1:18195/ inside a
 * wxWebView, and stages "Send to Prepare" STL files into <spoolDir>,
 * where the native app picks them up. The original script is not part of
 * the public source (not at the RC1 tag, and not in the Design source
 * published afterwards), so this replacement implements the contract
 * recovered from the two public sides of it:
 *
 *   App side (MainFrame.cpp):
 *     - expects <spoolDir>/<ticket> files, ticket = 32 lowercase hex
 *       chars + ".stl", 134 bytes <= size <= 80 MiB, binary STL header;
 *     - the WebView only trusts pages under http://127.0.0.1:18195/.
 *
 *   Design side (design/src/lib/prepareHandoff.ts, published source):
 *     - GET  /ad5x-handoff/status -> { ok: true,
 *            bridge: "AD5X Design local STL handoff" }
 *     - POST /ad5x-handoff/stl    (header "X-AD5X-Prepare: 1",
 *            Content-Type: application/octet-stream, raw STL body)
 *            -> { ok: true, ticket: "<32hex>.stl", bytes: <n> }
 *     - POST /ad5x-handoff/cad-stl (verified clamp-mesh CAD service)
 *            -> NOT reimplemented: this bridge has no CAD kernel, so it
 *               answers 501 and the Design UI reports the verified-mesh
 *               service as unavailable instead of silently degrading,
 *               which is the behaviour the frontend was written for.
 *
 * Static files are served from <wwwDir>. Loopback only, no dependencies.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const wwwDir = path.resolve(process.argv[2] || 'www');
const port = parseInt(process.argv[3] || '18195', 10);
const spoolDir = path.resolve(process.argv[4] || 'Handoff_Spool');
const MAX_STL = 80 * 1024 * 1024;
const MIN_STL = 134;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.stl': 'model/stl',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function handleStatus(req, res) {
  sendJson(res, 200, { ok: true, bridge: 'AD5X Design local STL handoff' });
}

function handleStlUpload(req, res) {
  if (req.headers['x-ad5x-prepare'] !== '1') {
    return sendJson(res, 400, { ok: false, error: 'Missing X-AD5X-Prepare header.' });
  }
  const chunks = [];
  let size = 0;
  let aborted = false;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_STL) {
      aborted = true;
      sendJson(res, 413, { ok: false, error: 'STL exceeds the 80 MiB handoff limit.' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    if (aborted) return;
    const body = Buffer.concat(chunks);
    if (body.length < MIN_STL) {
      return sendJson(res, 400, { ok: false, error: 'STL is too small to be valid.' });
    }
    const ticket = crypto.randomBytes(16).toString('hex') + '.stl';
    fs.mkdirSync(spoolDir, { recursive: true });
    fs.writeFileSync(path.join(spoolDir, ticket), body);
    sendJson(res, 200, { ok: true, ticket, bytes: body.length });
  });
  req.on('error', () => {
    if (!aborted) sendJson(res, 500, { ok: false, error: 'Upload failed.' });
  });
}

function handleStatic(req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Bad URL.' });
  }
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(wwwDir, urlPath);
  if (!filePath.startsWith(wwwDir)) {
    return sendJson(res, 403, { ok: false, error: 'Forbidden.' });
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA fallback so client-side routes load the app shell.
      const index = path.join(wwwDir, 'index.html');
      if (fs.existsSync(index)) {
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        return fs.createReadStream(index).pipe(res);
      }
      return sendJson(res, 404, { ok: false, error: 'Not found.' });
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  if (req.method === 'GET' && pathname === '/ad5x-handoff/status') {
    return handleStatus(req, res);
  }
  if (req.method === 'POST' && pathname === '/ad5x-handoff/stl') {
    return handleStlUpload(req, res);
  }
  if (req.method === 'POST' && pathname === '/ad5x-handoff/cad-stl') {
    return sendJson(res, 501, {
      ok: false,
      error: 'The verified clamp-mesh CAD service is not available in this build.',
    });
  }
  if (req.method === 'GET' || req.method === 'HEAD') {
    return handleStatic(req, res);
  }
  sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`AD5X Design local STL handoff listening on http://127.0.0.1:${port}/`);
  console.log(`  www:   ${wwwDir}`);
  console.log(`  spool: ${spoolDir}`);
});
