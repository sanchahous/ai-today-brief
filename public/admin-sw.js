const OFFLINE_HTML = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#101418"><title>AI Today Brief CMS · Offline</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0c1014;color:#e2e8f0;font:16px system-ui">
<main style="max-width:28rem;padding:2rem;text-align:center"><h1 style="color:#fff">You are offline</h1>
<p>Reconnect before reviewing or approving social content. Private CMS data is never cached on this device.</p></main></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || request.mode !== 'navigate' || !url.pathname.startsWith('/admin')) {
    return;
  }
  event.respondWith(
    fetch(request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
        }),
    ),
  );
});
