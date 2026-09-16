const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

function harness(options = {}) {
  const modules = new Map();
  const disk = new Map();
  const remote = new Map();
  const writes = [];
  let putHook = options.putHook;
  let token = 'test-only-token';
  const fileSystem = {
    documentDirectory: 'file:///documents/', EncodingType: { Base64: 'base64' },
    makeDirectoryAsync: async () => {},
    getInfoAsync: async (uri) => ({ exists: disk.has(uri), size: disk.get(uri)?.length ?? 0 }),
    readAsStringAsync: async (uri) => { if (!disk.has(uri)) throw Error('Missing local file'); return disk.get(uri); },
    writeAsStringAsync: async (uri, data) => { disk.set(uri, data); },
    deleteAsync: async (uri) => { for (const key of disk.keys()) if (key.startsWith(uri)) disk.delete(key); },
  };
  function sha(data) { const bytes = Buffer.from(data, 'base64'); return crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'); }
  const fetch = async (url, init) => {
    if (options.fetch) return options.fetch(url, init);
    const filename = decodeURIComponent(url.split('/contents/')[1]?.split('?')[0] ?? '');
    if (init.method === 'PUT') {
      const body = JSON.parse(init.body);
      writes.push({ filename, body });
      if (putHook) { const result = await putHook({ filename, body, remote, sha }); if (result) return result; }
      remote.set(filename, { sha: sha(body.content), content: body.content });
      return new Response(JSON.stringify({ content: { sha: sha(body.content) } }), { status: 201 });
    }
    return remote.has(filename) ? new Response(JSON.stringify(remote.get(filename))) : new Response('{}', { status: 404 });
  };
  function load(name) {
    const full = path.resolve(__dirname, '../src', name + '.ts');
    if (modules.has(full)) return modules.get(full);
    const exports = {};
    modules.set(full, exports);
    const ctx = { exports, fetch, Response, AbortController, Uint8Array, setTimeout: (fn, ms) => setTimeout(fn, ms < 60000 ? 0 : ms), clearTimeout,
      require: (id) => {
        if (id === 'expo-crypto') return { randomUUID: crypto.randomUUID, CryptoDigestAlgorithm: { SHA1: 'SHA-1' }, digest: async (_, bytes) => Uint8Array.from(crypto.createHash('sha1').update(bytes).digest()).buffer };
        if (id === 'expo-file-system/legacy') return fileSystem;
        if (id === 'expo-secure-store') return { getItemAsync: async () => token, setItemAsync: async (_, value) => { token = value; }, deleteItemAsync: async () => { token = null; } };
        if (id.startsWith('.')) return load(path.relative(path.resolve(__dirname, '../src'), path.resolve(path.dirname(full), id)));
        throw Error('Unexpected import: ' + id);
      },
    };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, ctx, { filename: full });
    return exports;
  }
  return { load, disk, remote, writes, fileSystem, sha, setPutHook: (fn) => { putHook = fn; } };
}

function sample(cars) { return { ...cars.emptyCar(), year: '2023', make: 'Ford', model: 'F150', price: '24,500', mileage: '93,000' }; }

test('listing text roundtrips quotes, backslashes, Unicode and line breaks without accumulating escapes', () => {
  const cars = harness().load('cars');
  let car = { ...sample(cars), model: 'F150 "Sport" \\ Україна 🚗', engine: 'line one\nline two', body: 'Notes\n\nMore notes', main_image: 'images/uploads/a.jpg' };
  const expected = JSON.stringify(car);
  for (let i = 0; i < 5; i++) car = cars.parseCar(cars.serializeCar(car));
  assert.equal(JSON.stringify(car), expected);
  assert.equal(cars.parseCar("---\nmake: 'O''Brien'\n---\n").make, "O'Brien");
});

test('number validation accepts grouped values, rejects partial parses, negative values and YAML injection', () => {
  const cars = harness().load('cars');
  assert.equal(cars.normalizeNumber('24,500'), '24500');
  for (const value of ['24,50', '100abc', '-10', 'Infinity', '1e4', '100\nsold: true']) assert.equal(cars.normalizeNumber(value), null, value);
  assert.equal(cars.validateCar(sample(cars), 10), null);
  assert.ok(cars.validateCar({ ...sample(cars), mileage: '1.5' }, 1));
  assert.ok(cars.validateCar(sample(cars), 11));
});

test('two identical cars get unique persistent IDs; existing listing URLs are retained', () => {
  const h = harness(), drafts = h.load('drafts'), cars = h.load('cars');
  const a = drafts.prepareDraft({ ...drafts.createDraft(null), car: sample(cars) });
  const b = drafts.prepareDraft({ ...drafts.createDraft(null), car: sample(cars) });
  assert.notEqual(a.car.path, b.car.path);
  assert.equal(drafts.prepareDraft(a).car.path, a.car.path);
  assert.equal(drafts.prepareDraft(drafts.createDraft({ ...sample(cars), path: '_cars/old-url.md' })).car.path, '_cars/old-url.md');
});

test('portrait and small photos preserve aspect ratio and are never enlarged', () => {
  const fit = harness().load('photoSizing').fitPhoto;
  assert.equal(JSON.stringify(fit(3000, 4000, 1600)), JSON.stringify({ width: 1200, height: 1600 }));
  assert.equal(JSON.stringify(fit(200, 100, 480)), JSON.stringify({ width: 200, height: 100 }));
  assert.throws(() => fit(0, 400, 1600));
});

test('draft saves serialize; damaged latest snapshot falls back; cleanup is ordered after queued saves', async () => {
  const h = harness(), d = h.load('drafts');
  const first = d.createDraft(null), second = { ...first, car: { ...first.car, model: 'Updated' } };
  await Promise.all([d.saveDraft('new', first), d.saveDraft('new', second)]);
  assert.equal((await d.loadDraft('new')).car.model, 'Updated');
  h.disk.set(d.photoUri('new', 'draft-0.json'), '{broken');
  assert.equal((await d.loadDraft('new')).car.model, '');
  await Promise.all([d.saveDraft('new', second), d.deleteDraft('new')]);
  assert.equal(await d.loadDraft('new'), null);
});

test('unreadable drafts are preserved rather than overwritten', async () => {
  const h = harness(), d = h.load('drafts');
  h.disk.set(d.photoUri('new', 'draft-0.json'), 'broken');
  await assert.rejects(d.loadDraft('new'), /recovery/);
  assert.equal(h.disk.size, 1);
});

test('Git blob SHA is correct for text and binary bytes', async () => {
  const h = harness(), gh = h.load('github');
  for (const buffer of [Buffer.from('Україна 🚗'), Buffer.from([0, 255, 1, 128]), crypto.randomBytes(2000)]) {
    assert.equal(await gh.blobSha(buffer.toString('base64')), h.sha(buffer.toString('base64')));
  }
});

test('a lost PUT response is recognized without another upload', async () => {
  let first = true;
  const h = harness({ putHook: ({ filename, body, remote, sha }) => {
    if (first) { first = false; remote.set(filename, { sha: sha(body.content), content: body.content }); throw Error('Connection lost after commit'); }
  } });
  await h.load('github').putTextFile('_cars/test.md', 'Listing', 'Test');
  assert.equal(h.writes.length, 1);
});

test('concurrent edit is rejected without overwriting another user’s listing', async () => {
  const h = harness();
  h.remote.set('_cars/existing.md', { sha: 'newer-sha', content: 'abc' });
  await assert.rejects(h.load('github').putTextFile('_cars/existing.md', 'Changed', 'Test', 'old-sha'), /changed on GitHub/);
  assert.equal(h.writes.length, 0);
});

test('401 stops immediately and tells the user to replace the token', async () => {
  let calls = 0;
  const h = harness({ fetch: async () => { calls++; return new Response('{}', { status: 401 }); } });
  await assert.rejects(h.load('github').putTextFile('a', 'b', 'c'), /token/);
  assert.equal(calls, 1);
});

test('retry after a failed second photo reuses first photo and thumbnail, then saves exactly one listing', async () => {
  const h = harness(), drafts = h.load('drafts'), cars = h.load('cars');
  const draft = drafts.prepareDraft({ ...drafts.createDraft(null), car: sample(cars), images: [
    { id: '1', repoPath: 'images/uploads/1.jpg', localFile: '1.jpg', thumbFile: '1-thumb.jpg' },
    { id: '2', repoPath: 'images/uploads/2.jpg', localFile: '2.jpg', thumbFile: '2-thumb.jpg' },
  ] });
  for (const name of ['1.jpg', '1-thumb.jpg', '2.jpg', '2-thumb.jpg']) h.disk.set(drafts.photoUri('new', name), Buffer.from(name).toString('base64'));
  h.setPutHook(({ filename }) => filename === 'images/uploads/2.jpg' ? new Response('{}', { status: 403 }) : null);
  const publish = h.load('publish').publishDraft;
  await assert.rejects(publish('new', draft, () => {}), /denied/);
  assert.equal(h.remote.size, 2);
  h.setPutHook(null);
  await publish('new', draft, () => {});
  await publish('new', draft, () => {});
  assert.equal(h.remote.size, 5);
  assert.equal(h.writes.filter(w => w.filename === 'images/uploads/1.jpg').length, 1);
  assert.equal(h.writes.filter(w => w.filename.startsWith('_cars/')).length, 1);
  const saved = cars.parseCar(Buffer.from(h.remote.get(draft.car.path).content, 'base64').toString());
  assert.equal(saved.price, '24500');
  assert.equal(saved.mileage, '93000');
});
