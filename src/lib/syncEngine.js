/**
 * Outbox Sync Engine
 * Manages background queue for offline mutations (POST, PUT, DELETE).
 * When online, sequentially replays actions to the server and dispatches status events.
 */

import { getAll, putItem, deleteItem, getDb } from './offlineDb';

let isSyncing = false;
let syncListenersInitialized = false;

export const SYNC_EVENT_NAME = 'guruapp_sync_status';

export function emitSyncEvent(status, details = {}) {
	if (typeof window !== 'undefined') {
		window.dispatchEvent(
			new CustomEvent(SYNC_EVENT_NAME, {
				detail: { status, timestamp: Date.now(), ...details },
			})
		);
	}
}

/**
 * Enqueue a mutation action to be synced online
 * @param {Object} param0
 * @param {string} param0.type - e.g. 'ABSENSI', 'JURNAL', 'NILAI', 'CATATAN', 'POIN'
 * @param {string} param0.endpoint - e.g. '/api/absensi-mapel'
 * @param {string} param0.method - 'POST' | 'PUT' | 'DELETE'
 * @param {Object} param0.payload - Request body object
 * @param {string} [param0.description] - Human-readable description
 * @param {Object} [param0.attachment] - Optional staged file/photo data { base64, fileName, mimeType, bucket }
 */
export async function enqueueAction({ type, endpoint, method = 'POST', payload, description = '', attachment = null }) {
	const actionItem = {
		type,
		endpoint,
		method,
		payload,
		description,
		attachment,
		status: 'pending',
		attempts: 0,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};

	const id = await putItem('sync_queue', actionItem);
	emitSyncEvent('enqueued', { id, type, description, queueLength: (await getPendingCount()) });

	// If currently online, try to process immediately
	if (typeof window !== 'undefined' && window.navigator.onLine) {
		setTimeout(() => {
			processSyncQueue();
		}, 300);
	}

	return id;
}

/**
 * Get count of pending actions
 */
export async function getPendingCount() {
	try {
		const items = await getAll('sync_queue');
		return items.filter((item) => item.status === 'pending').length;
	} catch (e) {
		return 0;
	}
}

/**
 * Get all pending actions
 */
export async function getPendingActions() {
	try {
		const items = await getAll('sync_queue');
		return items
			.filter((item) => item.status === 'pending')
			.sort((a, b) => a.createdAt - b.createdAt);
	} catch (e) {
		return [];
	}
}

/**
 * Process all pending actions in queue (FIFO)
 */
export async function processSyncQueue() {
	if (typeof window === 'undefined' || !window.navigator.onLine) return;
	if (isSyncing) return;

	try {
		isSyncing = true;
		const pendingActions = await getPendingActions();
		if (pendingActions.length === 0) {
			emitSyncEvent('idle', { queueLength: 0 });
			return;
		}

		emitSyncEvent('syncing_started', { queueLength: pendingActions.length });
		let successCount = 0;
		let failCount = 0;

		for (const action of pendingActions) {
			try {
				let requestBody = { ...action.payload };

				// If there is a staged attachment photo that needs upload, handle it here
				if (action.attachment && action.attachment.base64) {
					// We keep the payload as-is or pass the attachment
					requestBody._attachment = action.attachment;
				}

				const res = await fetch(action.endpoint, {
					method: action.method,
					headers: {
						'Content-Type': 'application/json',
						'X-Offline-Synced': 'true',
					},
					body: JSON.stringify(requestBody),
				});

				if (res.ok) {
					// Remove completed item from queue
					await deleteItem('sync_queue', action.id);
					successCount++;
					emitSyncEvent('item_synced', { id: action.id, type: action.type });
				} else {
					console.warn(`Sync queue item ${action.id} returned status ${res.status}`);
					action.attempts = (action.attempts || 0) + 1;
					action.lastError = `Status ${res.status}: ${res.statusText}`;
					action.updatedAt = Date.now();
					await putItem('sync_queue', action);
					failCount++;
				}
			} catch (err) {
				console.error(`Sync queue item ${action.id} failed:`, err);
				action.attempts = (action.attempts || 0) + 1;
				action.lastError = err.message;
				action.updatedAt = Date.now();
				await putItem('sync_queue', action);
				failCount++;
				// Network broke during sync
				break;
			}
		}

		const remaining = await getPendingCount();
		emitSyncEvent('syncing_completed', {
			successCount,
			failCount,
			queueLength: remaining,
		});
	} catch (globalErr) {
		console.error('processSyncQueue global error:', globalErr);
		emitSyncEvent('error', { error: globalErr.message });
	} finally {
		isSyncing = false;
	}
}

/**
 * Initialize sync engine event listeners (call once at root layout)
 */
export function initSyncEngine() {
	if (typeof window === 'undefined' || syncListenersInitialized) return;

	window.addEventListener('online', () => {
		emitSyncEvent('online');
		setTimeout(() => {
			processSyncQueue();
		}, 500);
	});

	window.addEventListener('offline', () => {
		emitSyncEvent('offline');
	});

	// Periodic check every 30 seconds if online
	setInterval(() => {
		if (window.navigator.onLine && !isSyncing) {
			processSyncQueue();
		}
	}, 30000);

	syncListenersInitialized = true;

	// Initial trigger
	if (window.navigator.onLine) {
		setTimeout(processSyncQueue, 1500);
	}
}
