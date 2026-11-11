// Keeps saved games in the browser's built-in database (IndexedDB), one per save slot.

const DATABASE_NAME = "far-hollow";
const DATABASE_VERSION = 1;
const STORE_NAME = "saves";

/** How many save slots the start screen offers. */
export const SAVE_SLOT_COUNT = 3;

/** The key a slot's save is stored under. Slots are numbered from 0. */
function slotKey(slot: number): string {
  return `slot-${slot + 1}`;
}

/** Where the game kept its one save before there were save slots. Slot 1 shows that save until slot 1 is saved again. */
const OLD_SAVE_KEY = "current";

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
  /** The save stored in a slot, or undefined if there is none. It may be broken, so check it before use. Slots are numbered from 0. */
  read(slot: number): Promise<unknown>;
  /** Replaces the save stored in a slot. */
  write(slot: number, save: unknown): Promise<void>;
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
    read: async (slot) => {
      const save: unknown = await run("readonly", (store) => store.get(slotKey(slot)));
      if (save !== undefined || slot !== 0) return save;
      return run<unknown>("readonly", (store) => store.get(OLD_SAVE_KEY));
    },
    write: async (slot, save) => {
      await run("readwrite", (store) => store.put(save, slotKey(slot)));
    },
  };
}
