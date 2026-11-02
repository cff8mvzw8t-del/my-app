import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { basePath, preparePwa } from './prepare-pwa.mjs';

test('Pages base path is constrained', () => {
  assert.equal(basePath('/my-app/'), '/my-app/');
  assert.equal(basePath(), '/');
  assert.throws(() => basePath('/../other'));
});

test('production export prepares a scoped manifest and complete offline shell', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'roster-pwa-'));
  try {
    await mkdir(join(dir, '_expo'), { recursive: true });
    await writeFile(join(dir, '_expo/app.js'), 'app');
    await writeFile(join(dir, 'index.html'), '<html lang="en"><head></head><body><script src="/my-app/_expo/app.js"></script></body></html>');
    await writeFile(join(dir, 'iphone-preview.html'), 'preview');
    await writeFile(join(dir, 'refresh.html'), 'recovery');
    const result = await preparePwa(dir, '/my-app/');
    assert(result.urls.includes('/my-app/index.html'));
    assert(result.urls.includes('/my-app/_expo/app.js'));
    assert(!result.urls.includes('/my-app/iphone-preview.html'));
    assert(!result.urls.includes('/my-app/refresh.html'));
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.scope, '/my-app/');
    assert.equal(manifest.start_url, '/my-app/');
    const html = await readFile(join(dir, 'index.html'), 'utf8');
    assert.match(html, /lang="he" dir="rtl"/);
    assert.match(html, /direction: ltr/);
    assert.match(html, /background: #000/);
    // Deprecated translucent status-bar mode and dvh can reserve an extra
    // status-bar-height strip in installed iPhone web apps (WebKit 313800).
    assert.doesNotMatch(html, /black-translucent|100dvh/);
    assert.match(html, /\/my-app\/pwa-register.js/);

    const handlers = {};
    const calls = [];
    let windows = [{ url: 'https://example.test/my-app/' }];
    const worker = {
      location: { origin: 'https://example.test' },
      addEventListener: (name, handler) => { handlers[name] = handler; },
      clients: { claim: async () => {}, matchAll: async () => windows },
      skipWaiting: async () => { calls.push('activate'); },
    };
    vm.runInNewContext(await readFile(join(dir, 'sw.js'), 'utf8'), {
      self: worker, URL,
      caches: {
        open: async () => ({ addAll: async urls => calls.push([...urls]), match: async key => `cached:${key}` }),
        keys: async () => ['unrelated-cache', 'personal-control-shell:/my-app/:old'],
        delete: async key => calls.push(`deleted:${key}`),
      },
      fetch: () => { throw new Error('Network unavailable'); },
    });
    let pending;
    handlers.install({ waitUntil: promise => { pending = promise; } }); await pending;
    assert(calls[0].includes('/my-app/_expo/app.js'));
    handlers.activate({ waitUntil: promise => { pending = promise; } }); await pending;
    assert(calls.includes('deleted:personal-control-shell:/my-app/:old'));
    assert(!calls.includes('deleted:unrelated-cache'));
    handlers.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://example.test/my-app/?refresh=1' }, respondWith: promise => { pending = promise; } });
    assert.equal(await pending, 'cached:/my-app/index.html');
    handlers.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://example.test/my-app/_expo/app.js' }, respondWith: promise => { pending = promise; } });
    assert.equal(await pending, 'cached:/my-app/_expo/app.js');
    let intercepted = false;
    handlers.fetch({ request: { method: 'GET', mode: 'cors', url: 'https://example.test/other-app/' }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
    windows.push({ url: 'https://example.test/my-app/' });
    handlers.message({ data: { type: 'ACTIVATE_UPDATE' }, source: { postMessage: data => calls.push(data.type) }, waitUntil: promise => { pending = promise; } }); await pending;
    assert(calls.includes('UPDATE_BLOCKED'));
    assert(!calls.includes('activate'));
    windows = windows.slice(0,1);
    handlers.message({ data: { type: 'ACTIVATE_UPDATE' }, waitUntil: promise => { pending = promise; } }); await pending;
    assert(calls.includes('activate'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
