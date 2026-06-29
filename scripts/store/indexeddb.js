/**
 * NikoAI — IndexedDB 持久化层
 * 纯数据层，不关心谁调用，不操作 DOM。
 * 导出 async CRUD 函数，供 /store 下各领域模块使用。
 */

const DB_NAME = 'NikoAI';
const DB_VERSION = 2;

let _db = null;

async function _openDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('providers')) {
        db.createObjectStore('providers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('agents')) {
        db.createObjectStore('agents', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('plugins')) {
        db.createObjectStore('plugins', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('workflows')) {
        db.createObjectStore('workflows', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('tools')) {
        db.createObjectStore('tools', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export const StorageEngine = {
  /**
   * 获取所有记录
   * @param {string} storeName - 仓库名称
   * @returns {Promise<Array>}
   */
  async getAll(storeName) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * 获取单条记录
   * @param {string} storeName
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async get(storeName, id) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  /**
   * 写入记录（新增或覆盖）
   * @param {string} storeName
   * @param {Object} data - 必须包含 id 字段
   * @returns {Promise<void>}
   */
  async put(storeName, data) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * 删除记录
   * @param {string} storeName
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(storeName, id) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * 清空仓库
   * @param {string} storeName
   * @returns {Promise<void>}
   */
  async clear(storeName) {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
};
