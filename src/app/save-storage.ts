// Keeps the saved game in the browser's built-in database (IndexedDB).

const DATABASE_NAME = "far-hollow";
const DATABASE_VERSION = 1;
const STORE_NAME = "saves";
/** There is one save for now. Save slots will each get their own key. */
const SAVE_KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("Could not open the save database"));
    };
  });
}

export interface SaveStorage {
  /** The stored save, or undefined if there is none. It may be broken, so check it before use. */
  read(): Promise<unknown>;
  /** Replaces the stored save. */
  write(save: unknown): Promise<void>;
}

export async function openSaveStorage(): Promise<SaveStorage> {
  const database = await openDatabase();
  function run<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const request = use(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onerror = () => {
        reject(request.error ?? new Error("Could not use the save database"));
      };
    });
  }
  return {
    read: () => run("readonly", (store) => store.get(SAVE_KEY)),
    write: async (save) => {
      await run("readwrite", (store) => store.put(save, SAVE_KEY));
    },
  };
}
