/**
 * A minimal in-memory Firestore for season-ops tests. Documents live in a Map keyed by full path.
 * Supports only what the season-ops runners use: doc(path), collection(path), get() on both,
 * doc set (with merge), create, update and delete, and bulkWriter() set/delete/close.
 */
const clone = (v) => (v === undefined ? v : structuredClone(v));

/** Stands in for FieldValue.delete(): an update that carries it removes the field. */
const DELETE = Symbol('FieldValue.delete');
const applyUpdate = (existing, data) => {
  const next = { ...existing };
  Object.entries(data).forEach(([k, v]) => { if (v === DELETE) delete next[k]; else next[k] = clone(v); });
  return next;
};

const fakeFirestore = (seed = {}) => {
  const docs = new Map(Object.entries(seed).map(([p, d]) => [p, clone(d)]));

  const docRef = (path) => ({
    path,
    id: path.split('/').pop(),
    get: async () => snap(path),
    set: async (data, opts) => {
      docs.set(path, opts?.merge ? { ...(docs.get(path) || {}), ...clone(data) } : clone(data));
    },
    create: async (data) => {
      if (docs.has(path)) throw new Error(`create of existing doc ${path}`);
      docs.set(path, clone(data));
    },
    update: async (data) => {
      if (!docs.has(path)) throw new Error(`update of missing doc ${path}`);
      docs.set(path, applyUpdate(docs.get(path), data));
    },
    delete: async () => { docs.delete(path); },
  });

  const snap = (path) => ({
    id: path.split('/').pop(),
    ref: docRef(path),
    exists: docs.has(path),
    data: () => clone(docs.get(path)),
  });

  const collectionRef = (path) => ({
    path,
    get: async () => {
      const depth = path.split('/').length + 1;
      const hits = [...docs.keys()].filter((p) => p.startsWith(`${path}/`) && p.split('/').length === depth);
      return { docs: hits.map(snap), size: hits.length };
    },
  });

  return {
    docs,
    doc: docRef,
    collection: collectionRef,
    bulkWriter: () => {
      const ops = [];
      return {
        set: (ref, data) => { ops.push(() => docs.set(ref.path, clone(data))); },
        delete: (ref) => { ops.push(() => docs.delete(ref.path)); },
        close: async () => { ops.forEach((op) => op()); },
      };
    },
  };
};

module.exports = { fakeFirestore, DELETE };
