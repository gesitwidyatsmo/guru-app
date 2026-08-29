'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPendingCount, processSyncQueue, SYNC_EVENT_NAME } from '@/lib/syncEngine';

export function useNetworkStatus() {
	const [isOnline, setIsOnline] = useState(() => (typeof window !== 'undefined' ? window.navigator.onLine : true));
	const [pendingCount, setPendingCount] = useState(0);
	const [isSyncing, setIsSyncing] = useState(false);
	const [lastSyncResult, setLastSyncResult] = useState(null);

	const updatePending = useCallback(async () => {
		const count = await getPendingCount();
		setPendingCount(count);
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		updatePending();

		const handleOnline = () => {
			setIsOnline(true);
			updatePending();
		};

		const handleOffline = () => {
			setIsOnline(false);
			updatePending();
		};

		const handleSyncStatus = (event) => {
			const detail = event.detail || {};
			if (detail.queueLength !== undefined) {
				setPendingCount(detail.queueLength);
			} else {
				updatePending();
			}

			if (detail.status === 'syncing_started') {
				setIsSyncing(true);
			} else if (detail.status === 'syncing_completed' || detail.status === 'idle') {
				setIsSyncing(false);
				if (detail.status === 'syncing_completed') {
					setLastSyncResult(detail);
				}
			}
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);
		window.addEventListener(SYNC_EVENT_NAME, handleSyncStatus);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
			window.removeEventListener(SYNC_EVENT_NAME, handleSyncStatus);
		};
	}, [updatePending]);

	const triggerSync = useCallback(() => {
		if (isOnline) {
			processSyncQueue();
		}
	}, [isOnline]);

	return {
		isOnline,
		pendingCount,
		isSyncing,
		lastSyncResult,
		triggerSync,
	};
}
