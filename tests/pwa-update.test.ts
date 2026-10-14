import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('PWA usa JavaScript atual quando online e cache quando offline', async () => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(source, /f1-universe-static-61000-v1/, 'o marco visual 61000 precisa ativar um cache de versão diferente');
  const listeners: Record<string, (event: any) => void> = {};
  let online = true;
  const fresh = { ok: true, version: 'new', clone() { return this; } };
  const stale = { ok: true, version: 'old', clone() { return this; } };
  runInNewContext(source, {
    self: { addEventListener: (name: string, handler: (event: any) => void) => { listeners[name] = handler; }, skipWaiting() {}, clients: { claim() {} } },
    caches: { match: async () => stale, open: async () => ({ put: async () => {}, addAll: async () => {} }), keys: async () => [] },
    fetch: async () => { if (!online) throw new Error('offline'); return fresh; },
    URL,
    location: { origin: 'https://game.example' },
    Response: { error: () => ({ version: 'error' }) },
    Promise,
  });
  const request = () => {
    let response: Promise<{ version: string }> | undefined;
    listeners.fetch({ request: { method: 'GET', mode: 'same-origin', url: 'https://game.example/assets/latest-app.js' }, respondWith: (value: Promise<{ version: string }>) => { response = value; } });
    return response!;
  };
  assert.equal((await request()).version, 'new');
  online = false;
  assert.equal((await request()).version, 'old');
});

test('PWA serves cached GLB models offline and never touches saves or API calls', async () => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const listeners: Record<string, (event: any) => void> = {};
  let online = false;
  const cached = { ok: true, version: 'cached-glb', clone() { return this; } };
  runInNewContext(source, {
    self: { addEventListener: (name: string, handler: (event: any) => void) => { listeners[name] = handler; }, skipWaiting() {}, clients: { claim() {} } },
    caches: { match: async () => cached, open: async () => ({ put: async () => {}, addAll: async () => {} }), keys: async () => [] },
    fetch: async () => { if (!online) throw new Error('offline'); return cached; },
    URL, location: { origin: 'https://game.example' }, Response: { error: () => ({ version: 'error' }) }, Promise,
  });
  const ask = (url: string, method = 'GET') => {
    let response: Promise<{ version: string }> | undefined;
    listeners.fetch({ request: { method, mode: 'same-origin', url }, respondWith: (value: Promise<{ version: string }>) => { response = value; } });
    return response;
  };
  assert.equal((await ask('https://game.example/assets/f1-3d/cars/ferrari_mobile.glb'))!.version, 'cached-glb');
  assert.equal(ask('https://game.example/api/save'), undefined, 'non-static paths are not intercepted');
  assert.equal(ask('https://game.example/assets/x.glb', 'POST'), undefined, 'only GET is cached');
  assert.equal(ask('https://cdn.babylonjs.com/babylon.js'), undefined, 'foreign origins are never cached');
});
