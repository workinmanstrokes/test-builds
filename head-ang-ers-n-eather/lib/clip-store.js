/** On-device audio blobs. IndexedDB only — nothing is uploaded. */

const DB_NAME = 'soundboard';
const STORE = 'clips';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, body) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let settled = false;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      try { db.close(); } catch (_) { /* already closed */ }
      fn(value);
    };
    tx.oncomplete = () => done(resolve, tx.__result);
    tx.onerror = () => done(reject, tx.error || new Error('storage error'));
    tx.onabort = () => done(reject, tx.error || new Error('storage aborted'));
    try {
      body(tx.objectStore(STORE), tx);
    } catch (err) {
      done(reject, err);
    }
  }));
}

export function putClip(id, blob) {
  return run('readwrite', (store) => {
    store.put(blob, id);
  });
}

export function getClip(id) {
  return run('readonly', (store, tx) => {
    const req = store.get(id);
    req.onsuccess = () => { tx.__result = req.result || null; };
  });
}

export function deleteClip(id) {
  return run('readwrite', (store) => {
    store.delete(id);
  });
}

export function clearClips() {
  return run('readwrite', (store) => {
    store.clear();
  });
}
