/**
 * Offline Database Manager using native IndexedDB with Promise-based API.
 * Provides high-capacity, persistent client-side storage for:
 * - Master data (siswa, kelas, mapel, jadwal, kategori poin)
 * - Daily transactions (absensi, jurnal, nilai, catatan, poin)
 * - Outbox sync queue (pending actions to be synced online)
 * - Staged attachments (photos/files in base64/blob)
 */

const DB_NAME = 'guruapp_offline_db';
const DB_VERSION = 1;

const STORES = [
	{ name: 'user_session', keyPath: 'key' },
	{ name: 'siswa', keyPath: 'id' },
	{ name: 'kelas', keyPath: 'id' },
	{ name: 'mapel', keyPath: 'id' },
	{ name: 'jadwal', keyPath: 'id' },
	{ name: 'poin', keyPath: 'id' },
	{ name: 'poin_kategori', keyPath: 'id' },
	{ name: 'jurnal', keyPath: 'id' },
	{ name: 'absensi_mapel', keyPath: 'id' },
	{ name: 'absensi_harian', keyPath: 'id' },
	{ name: 'nilai_tugas', keyPath: 'tugas_id' },
	{ name: 'catatan', keyPath: 'id' },
	{ name: 'sync_queue', keyPath: 'id', autoIncrement: true },
	{ name: 'metadata', keyPath: 'key' },
];

let dbPromise = null;

export function getDb() {
	if (typeof window === 'undefined') return Promise.resolve(null);
	if (dbPromise) return dbPromise;

	dbPromise = new Promise((resolve, reject) => {
		const request = window.indexedDB.open(DB_NAME, DB_VERSION);

		request.onupgradeneeded = (event) => {
			const db = event.target.result;
			STORES.forEach(({ name, keyPath, autoIncrement }) => {
				if (!db.objectStoreNames.contains(name)) {
					const options = {};
					if (keyPath) options.keyPath = keyPath;
					if (autoIncrement) options.autoIncrement = autoIncrement;
					const store = db.createObjectStore(name, options);

					// Useful indexes
					if (name === 'siswa') {
						store.createIndex('kelas', 'kelas', { unique: false });
						store.createIndex('status', 'status', { unique: false });
					} else if (name === 'jadwal') {
						store.createIndex('hari', 'hari', { unique: false });
						store.createIndex('id_user', 'id_user', { unique: false });
					} else if (name === 'jurnal') {
						store.createIndex('kelas', 'kelas', { unique: false });
						store.createIndex('guru_id', 'guru_id', { unique: false });
						store.createIndex('tanggal', 'tanggal', { unique: false });
					} else if (name === 'absensi_mapel') {
						store.createIndex('lookupKey', ['kelas', 'mapel', 'tanggal', 'jam_ke'], { unique: false });
					} else if (name === 'catatan') {
						store.createIndex('user_id', 'user_id', { unique: false });
						store.createIndex('pinned', 'pinned', { unique: false });
					} else if (name === 'sync_queue') {
						store.createIndex('status', 'status', { unique: false });
						store.createIndex('createdAt', 'createdAt', { unique: false });
					}
				}
			});
		};

		request.onsuccess = (event) => {
			resolve(event.target.result);
		};

		request.onerror = (event) => {
			console.error('IndexedDB open error:', event.target.error);
			reject(event.target.error);
		};
	});

	return dbPromise;
}

/**
 * Get all items from a store
 */
export async function getAll(storeName) {
	const db = await getDb();
	if (!db) return [];

	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(storeName, 'readonly');
			const store = tx.objectStore(storeName);
			const request = store.getAll();

			request.onsuccess = () => resolve(request.result || []);
			request.onerror = () => reject(request.error);
		} catch (err) {
			console.warn(`getAll error in ${storeName}:`, err);
			resolve([]);
		}
	});
}

/**
 * Get a single item by its key
 */
export async function getById(storeName, key) {
	const db = await getDb();
	if (!db || key === undefined || key === null) return null;

	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(storeName, 'readonly');
			const store = tx.objectStore(storeName);
			const request = store.get(key);

			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		} catch (err) {
			console.warn(`getById error in ${storeName} key ${key}:`, err);
			resolve(null);
		}
	});
}

/**
 * Put a single item (Insert or Update)
 */
export async function putItem(storeName, item) {
	const db = await getDb();
	if (!db) return null;

	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(storeName, 'readwrite');
			const store = tx.objectStore(storeName);
			const request = store.put(item);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		} catch (err) {
			console.error(`putItem error in ${storeName}:`, err);
			reject(err);
		}
	});
}

/**
 * Put multiple items in a single transaction (Bulk Upsert)
 */
export async function bulkPut(storeName, items) {
	const db = await getDb();
	if (!db || !Array.isArray(items) || items.length === 0) return true;

	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(storeName, 'readwrite');
			const store = tx.objectStore(storeName);

			items.forEach((item) => {
				if (item) store.put(item);
			});

			tx.oncomplete = () => resolve(true);
			tx.onerror = () => reject(tx.error);
		} catch (err) {
			console.error(`bulkPut error in ${storeName}:`, err);
			resolve(false);
		}
	});
}

/**
 * Delete a single item by key
 */
export async function deleteItem(storeName, key) {
	const db = await getDb();
	if (!db) return false;

	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(storeName, 'readwrite');
			const store = tx.objectStore(storeName);
			const request = store.delete(key);

			request.onsuccess = () => resolve(true);
			request.onerror = () => reject(request.error);
		} catch (err) {
			console.error(`deleteItem error in ${storeName}:`, err);
			reject(err);
		}
	});
}

/**
 * Clear all items in a store
 */
export async function clearStore(storeName) {
	const db = await getDb();
	if (!db) return false;

	return new Promise((resolve, reject) => {
		try {
			const tx = db.transaction(storeName, 'readwrite');
			const store = tx.objectStore(storeName);
			const request = store.clear();

			request.onsuccess = () => resolve(true);
			request.onerror = () => reject(request.error);
		} catch (err) {
			console.error(`clearStore error in ${storeName}:`, err);
			resolve(false);
		}
	});
}

/**
 * Store and retrieve active user session in IndexedDB
 */
export async function saveUserSession(user) {
	if (!user) return;
	return putItem('user_session', { key: 'current_user', ...user, updatedAt: Date.now() });
}

export async function getUserSession() {
	const session = await getById('user_session', 'current_user');
	return session || null;
}
