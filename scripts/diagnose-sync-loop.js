// Why is the server being written to when nobody is touching the app?
//
// If the stored version climbs while every device sits idle, two devices are
// disagreeing about something and pushing their own answer back and forth.
// The blob is encrypted, so only a browser holding the key can see what.
//
// Paste this into the DevTools console on a device where sync is unlocked. It
// watches until it has captured two different stored states, decrypts both
// locally, and reports WHICH FIELDS differ -- names, sizes and timestamps
// only, never task content. Nothing leaves the browser.
//
// A converged pair of devices produces "Only one state seen", which is the
// answer you want.
(async () => {
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const cfg = JSON.parse(localStorage['todo-matrix-sync-config'] || '{}');
  const rawKey = localStorage['todo-matrix-sync-key'];
  if (!rawKey) return console.log('Locked on this device - unlock sync first.');

  const key = await crypto.subtle.importKey(
    'raw', b64(rawKey), { name: 'AES-GCM', length: 256 }, true, ['decrypt']);

  const get = async () => {
    const r = await fetch(cfg.endpoint, {
      headers: { Authorization: 'Bearer ' + cfg.token }, cache: 'no-store' });
    const blob = await r.json();
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64(blob.iv) }, key, b64(blob.ciphertext));
    return { version: blob.version, len: blob.ciphertext.length,
             state: JSON.parse(new TextDecoder().decode(pt)) };
  };

  console.log('Sampling for up to ~40s...');
  const seen = new Map();
  let failures = 0, lastError = null;
  for (let i = 0; i < 25 && seen.size < 2; i++) {
    try {
      const s = await get();
      if (!seen.has(s.len)) seen.set(s.len, s);
    } catch (e) {
      // Swallowing this silently would report a failing fetch or a wrong key
      // as "converged", which is the opposite of the truth.
      failures++; lastError = e;
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  if (failures) console.log(`${failures} of 25 samples failed; last error:`, lastError);
  if (seen.size < 2) {
    return console.log(
      failures === 25
        ? 'Every sample failed - could not read the blob at all. See the error above.'
        : 'Only one state seen - the devices agree and nothing is looping.'
    );
  }

  const [x, y] = [...seen.values()];
  const size = v => JSON.stringify(v).length;
  console.log('state A: version', x.version, 'ciphertext', x.len);
  console.log('state B: version', y.version, 'ciphertext', y.len);
  console.log('--- which top-level fields differ ---');
  for (const f of ['todos', 'settings', 'quadrantConfigs', 'meta']) {
    const same = JSON.stringify(x.state[f]) === JSON.stringify(y.state[f]);
    console.log(f.padEnd(16), same ? 'same' : 'DIFFERS', ' A=' + size(x.state[f]) + 'B  B=' + size(y.state[f]) + 'B');
  }
  const idsOf = s => new Set(s.state.todos.map(t => t.id));
  const A = idsOf(x), B = idsOf(y);
  console.log('--- todos ---');
  console.log('count A/B           :', A.size, '/', B.size);
  console.log('only in A / only in B:', [...A].filter(i => !B.has(i)).length, '/', [...B].filter(i => !A.has(i)).length);
  const common = [...A].filter(i => B.has(i));
  const find = (s, i) => s.state.todos.find(t => t.id === i);
  const diff = common.filter(i => JSON.stringify(find(x, i)) !== JSON.stringify(find(y, i)));
  console.log('same id, different   :', diff.length);
  const fields = new Set();
  for (const i of diff.slice(0, 20)) {
    const ta = find(x, i), tb = find(y, i);
    for (const k of new Set([...Object.keys(ta), ...Object.keys(tb)]))
      if (JSON.stringify(ta[k]) !== JSON.stringify(tb[k])) fields.add(k);
  }
  console.log('fields that differ   :', [...fields].join(', ') || '(none)');
  console.log('--- meta ---');
  console.log('A', JSON.stringify(x.state.meta));
  console.log('B', JSON.stringify(y.state.meta));
})()
