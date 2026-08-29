'use client';

import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { initSyncEngine } from '@/lib/syncEngine';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle, CloudOff } from 'lucide-react';

export default function OfflineSyncIndicator() {
	const { isOnline, pendingCount, isSyncing, lastSyncResult, triggerSync } = useNetworkStatus();
	const [showToast, setShowToast] = useState(false);
	const [dismissed, setDismissed] = useState(false);

	useEffect(() => {
		initSyncEngine();
	}, []);

	useEffect(() => {
		if (lastSyncResult && lastSyncResult.successCount > 0) {
			setShowToast(true);
			const timer = setTimeout(() => setShowToast(false), 4000);
			return () => clearTimeout(timer);
		}
	}, [lastSyncResult]);

	// Reset dismissed when network goes offline
	useEffect(() => {
		if (!isOnline) {
			setDismissed(false);
		}
	}, [isOnline]);

	return (
		<>
			{/* Toast Notifikasi Sinkronisasi Sukses */}
			{showToast && (
				<div className='fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-300'>
					<div className='bg-[#00A693] text-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] px-4 py-3 flex items-center gap-3 font-bold text-sm'>
						<CheckCircle2 className='w-5 h-5 text-white' />
						<span>{lastSyncResult?.successCount || 0} data berhasil disinkronkan ke server!</span>
					</div>
				</div>
			)}

			{/* Floating Banner Status Offline / Sync Pending */}
			{(!isOnline || pendingCount > 0 || isSyncing) && !dismissed && (
				<div className='fixed top-3 left-1/2 -translate-x-1/2 z-[9998] w-[92%] max-w-md animate-in fade-in slide-in-from-top-3 duration-200'>
					<div
						className={`border-[3px] border-[#0D0D0D] shadow-[5px_5px_0px_0px_#0D0D0D] px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm font-black uppercase tracking-wider ${
							!isOnline
								? 'bg-[#F5C518] text-[#0D0D0D]'
								: isSyncing
								? 'bg-[#2F80ED] text-white'
								: 'bg-[#FFE8DC] text-[#0D0D0D]'
						}`}
					>
						<div className='flex items-center gap-2.5 min-w-0'>
							{!isOnline ? (
								<>
									<WifiOff className='w-4 h-4 shrink-0 text-[#E8451A]' />
									<span className='truncate'>Offline — Data Tersimpan di Perangkat</span>
								</>
							) : isSyncing ? (
								<>
									<RefreshCw className='w-4 h-4 shrink-0 animate-spin text-white' />
									<span className='truncate'>Menyinkronkan {pendingCount} Data...</span>
								</>
							) : (
								<>
									<CloudOff className='w-4 h-4 shrink-0 text-[#0D0D0D]' />
									<span className='truncate'>{pendingCount} Data Menunggu Sinkron</span>
								</>
							)}
						</div>

						<div className='flex items-center gap-2 shrink-0'>
							{isOnline && pendingCount > 0 && !isSyncing && (
								<button
									onClick={triggerSync}
									className='bg-[#0D0D0D] text-white px-2.5 py-1 text-[11px] font-black border-[2px] border-[#0D0D0D] hover:bg-white hover:text-[#0D0D0D] transition-colors'
								>
									Sync
								</button>
							)}
							<button
								onClick={() => setDismissed(true)}
								className='text-xs font-black opacity-70 hover:opacity-100 p-0.5'
								title='Sembunyikan sementara'
							>
								✕
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
