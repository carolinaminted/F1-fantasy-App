/**
 * A minimal in-memory Firestore for season-ops tests. Documents live in a Map keyed by full path.
 * Supports only what the season-ops runners use: doc(path), collection(path), get() on both,
 * doc set (with merge) and update, and bulkWriter() set/delete/close.
 */
const clone = (v) => (v === undefined ? v : structuredClone(v));

const fakeFirestore = (seed = {}) => {
  const docs = new Map(Object.entries(seed).map(([p, d]) => [p, clone(d)]));

  const docRef = (path) => ({
    path,
    id: path.split('/').pop(),
    get: async () => snap(path),
    set: async (data, opts) => {
      docs.set(path, opts?.merge ? { ...(docs.get(path) || {}), ...clone(data) } : clone(data));
    },
    update: async (data) => {
      if (!docs.has(path)) throw new Error(`update of missing doc ${path}`);
      docs.set(path, { ...docs.get(path), ...clone(data) });
    },
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

module.exports = { fakeFirestore };
