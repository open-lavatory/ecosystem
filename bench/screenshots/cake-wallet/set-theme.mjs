const [, , httpUrl, which] = process.argv;
const ws = new WebSocket(httpUrl.replace(/^http/, 'ws').replace(/\/?$/, '/ws'));
let id = 0; const pending = new Map();
const call = (method, params = {}) => new Promise((res, rej) => {
  const i = String(++id); pending.set(i, { res, rej });
  ws.send(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }));
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data); const p = pending.get(m.id); if (!p) return;
  pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result);
};
await new Promise((r) => (ws.onopen = r));
const vm = await call('getVM');
const iso = vm.isolates.find((i) => i.name === 'main') ?? vm.isolates[0];
const isolateId = iso.id;
const isolate = await call('getIsolate', { isolateId });
const obj = (objectId) => call('getObject', { isolateId, objectId });
const klass = async (uri, name) => {
  const l = isolate.libraries.find((l) => l.uri === uri);
  if (!l) throw new Error('library not found: ' + uri);
  const lib = await obj(l.id);
  const c = lib.classes.find((c) => c.name === name);
  if (!c) throw new Error('class not found: ' + name);
  return c;
};
const themeList = await obj((await klass('package:cake_wallet/themes/utils/theme_list.dart', 'ThemeList')).id);
const fieldRef = themeList.fields.find((f) => f.name === `${which}Theme`);
const field = await obj(fieldRef.id);
const theme = field.staticValue;
if (!theme || theme.type === 'Sentinel') throw new Error('ThemeList.' + which + 'Theme not initialised');
const storeClass = await klass('package:cake_wallet/themes/core/theme_store.dart', 'ThemeStore');
const set = await call('getInstances', { isolateId, objectId: storeClass.id, limit: 2 });
if (set.instances.length !== 1) throw new Error('ThemeStore instances: ' + set.instances.length);
const r = await call('invoke', {
  isolateId, targetId: set.instances[0].id, selector: 'setTheme', argumentIds: [theme.id],
});
console.log(r.type, r.kind ?? '', r.valueAsString ?? '');
ws.close();
