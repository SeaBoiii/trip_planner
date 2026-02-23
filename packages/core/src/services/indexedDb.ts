const DB_NAME = 'trip_planner';
const DB_VERSION = 1;

export const IDB_STORES = {
  attachments: 'attachments',
  routeCache: 'route_cache',
} as const;

type StoreName = (typeof IDB_STORES)[keyof typeof IDB_STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORES.attachments)) {
        db.createObjectStore(IDB_STORES.attachments);
      }
      if (!db.objectStoreNames.contains(IDB_STORES.routeCache)) {
        db.createObjectStore(IDB_STORES.routeCache);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);

    Promise.resolve(fn(store))
      .then((result) => {
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      })
      .catch((error) => {
        tx.abort();
        reject(error);
      });
  });
}

export async function idbGet<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return withStore(storeName, 'readonly', (store) => requestToPromise(store.get(key))) as Promise<T | undefined>;
}

export async function idbSet<T>(storeName: StoreName, key: IDBValidKey, value: T): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => requestToPromise(store.put(value, key)).then(() => undefined));
}

export async function idbDelete(storeName: StoreName, key: IDBValidKey): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => requestToPromise(store.delete(key)).then(() => undefined));
}

export async function idbClear(storeName: StoreName): Promise<void> {
  await withStore(storeName, 'readwrite', (store) => requestToPromise(store.clear()).then(() => undefined));
}

export async function idbGetAll<T>(storeName: StoreName): Promise<T[]> {
  return withStore(storeName, 'readonly', (store) => requestToPromise(store.getAll())) as Promise<T[]>;
}
