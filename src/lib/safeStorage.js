const memoryStorage = new Map();
const storageCache = new Map();

function getBrowserStorage(kind) {
  if (typeof window === "undefined") return null;
  if (storageCache.has(kind)) return storageCache.get(kind);

  try {
    const storage = window[kind];
    const testKey = "__ball_knowledge_storage_test__";
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    storageCache.set(kind, storage);
    return storage;
  } catch (error) {
    console.warn(`[boot] ${kind} unavailable`, error);
    storageCache.set(kind, null);
    return null;
  }
}

function createSafeStorage(kind) {
  return {
    getItem(key) {
      try {
        const storage = getBrowserStorage(kind);
        return storage ? storage.getItem(key) : memoryStorage.get(key) || null;
      } catch (error) {
        console.warn(`[boot] ${kind}.getItem failed`, error);
        return memoryStorage.get(key) || null;
      }
    },
    setItem(key, value) {
      const stringValue = String(value);
      memoryStorage.set(key, stringValue);

      try {
        const storage = getBrowserStorage(kind);
        if (storage) storage.setItem(key, stringValue);
      } catch (error) {
        console.warn(`[boot] ${kind}.setItem failed`, error);
      }
    },
    removeItem(key) {
      memoryStorage.delete(key);

      try {
        const storage = getBrowserStorage(kind);
        if (storage) storage.removeItem(key);
      } catch (error) {
        console.warn(`[boot] ${kind}.removeItem failed`, error);
      }
    },
  };
}

export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");
