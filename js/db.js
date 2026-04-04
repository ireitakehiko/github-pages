'use strict';

const DB = (() => {
  const DB_NAME = 'yt-likes-manager';
  const DB_VERSION = 1;
  let db = null;

  const STORES = {
    VIDEOS: 'videos',
    CATEGORIES: 'categories',
    ASSIGNMENTS: 'assignments',
  };

  function open() {
    return new Promise((resolve, reject) => {
      if (db) { resolve(db); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const database = e.target.result;

        if (!database.objectStoreNames.contains(STORES.VIDEOS)) {
          const vs = database.createObjectStore(STORES.VIDEOS, { keyPath: 'videoId' });
          vs.createIndex('publishedAt', 'publishedAt');
          vs.createIndex('title', 'title');
        }

        if (!database.objectStoreNames.contains(STORES.CATEGORIES)) {
          const cs = database.createObjectStore(STORES.CATEGORIES, { keyPath: 'id' });
          cs.createIndex('name', 'name');
          cs.createIndex('createdAt', 'createdAt');
        }

        if (!database.objectStoreNames.contains(STORES.ASSIGNMENTS)) {
          const as = database.createObjectStore(STORES.ASSIGNMENTS, { keyPath: 'id' });
          as.createIndex('videoId', 'videoId');
          as.createIndex('categoryId', 'categoryId');
        }
      };

      req.onsuccess = (e) => {
        db = e.target.result;
        resolve(db);
      };

      req.onerror = () => reject(req.error);
    });
  }

  function tx(storeName, mode = 'readonly') {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  function getAll(storeName) {
    return open().then(() => promisify(tx(storeName).getAll()));
  }

  function get(storeName, key) {
    return open().then(() => promisify(tx(storeName).get(key)));
  }

  function put(storeName, value) {
    return open().then(() => promisify(tx(storeName, 'readwrite').put(value)));
  }

  function putBulk(storeName, values) {
    return open().then(() => {
      return new Promise((resolve, reject) => {
        const t = db.transaction(storeName, 'readwrite');
        const store = t.objectStore(storeName);
        values.forEach(v => store.put(v));
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    });
  }

  function remove(storeName, key) {
    return open().then(() => promisify(tx(storeName, 'readwrite').delete(key)));
  }

  function clear(storeName) {
    return open().then(() => promisify(tx(storeName, 'readwrite').clear()));
  }

  function getByIndex(storeName, indexName, value) {
    return open().then(() => {
      return new Promise((resolve, reject) => {
        const store = tx(storeName);
        const index = store.index(indexName);
        const req = index.getAll(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
  }

  // ===== Videos =====
  const Videos = {
    getAll: () => getAll(STORES.VIDEOS),
    get: (id) => get(STORES.VIDEOS, id),
    put: (video) => put(STORES.VIDEOS, video),
    putBulk: (videos) => putBulk(STORES.VIDEOS, videos),
    clear: () => clear(STORES.VIDEOS),
    count: () => open().then(() => promisify(tx(STORES.VIDEOS).count())),
  };

  // ===== Categories =====
  const Categories = {
    getAll: () => getAll(STORES.CATEGORIES),
    get: (id) => get(STORES.CATEGORIES, id),
    put: (cat) => put(STORES.CATEGORIES, cat),
    delete: (id) => remove(STORES.CATEGORIES, id),
    count: () => open().then(() => promisify(tx(STORES.CATEGORIES).count())),
  };

  // ===== Assignments =====
  const Assignments = {
    getAll: () => getAll(STORES.ASSIGNMENTS),
    getByVideo: (videoId) => getByIndex(STORES.ASSIGNMENTS, 'videoId', videoId),
    getByCategory: (categoryId) => getByIndex(STORES.ASSIGNMENTS, 'categoryId', categoryId),
    put: (assignment) => put(STORES.ASSIGNMENTS, assignment),
    delete: (id) => remove(STORES.ASSIGNMENTS, id),
    deleteByVideo: (videoId) => {
      return getByIndex(STORES.ASSIGNMENTS, 'videoId', videoId).then(items => {
        return Promise.all(items.map(item => remove(STORES.ASSIGNMENTS, item.id)));
      });
    },
    deleteByCategory: (categoryId) => {
      return getByIndex(STORES.ASSIGNMENTS, 'categoryId', categoryId).then(items => {
        return Promise.all(items.map(item => remove(STORES.ASSIGNMENTS, item.id)));
      });
    },
  };

  return { Videos, Categories, Assignments, open };
})();
