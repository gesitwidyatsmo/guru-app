'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

export default function NotificationBell() {
	const [notifications, setNotifications] = useState([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [dropdownStyle, setDropdownStyle] = useState({});
	const dropdownRef = useRef(null);

	const unreadCount = notifications.filter((n) => !n.is_read).length;

	const updatePosition = useCallback(() => {
		if (!dropdownRef.current) return;
		const rect = dropdownRef.current.getBoundingClientRect();
		const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
		
		// Batas margin aman dari tepi layar (12px di mobile, 16px di desktop)
		const margin = windowWidth < 640 ? 12 : 16;
		
		// Lebar maksimum dropdown (340px di mobile, 384px di desktop), clamped agar tidak tembus layar
		const targetWidth = windowWidth < 640 ? 340 : 384;
		const actualWidth = Math.min(targetWidth, Math.max(260, windowWidth - margin * 2));
		
		// Default: sejajarkan dengan sisi kanan tombol (rect.right - actualWidth)
		let idealLeft = rect.right - actualWidth;
		
		// Cek batas kiri layar: jangan sampai terpotong di sisi kiri
		if (idealLeft < margin) {
			idealLeft = margin;
		}
		
		// Cek batas kanan layar: jangan sampai tembus di sisi kanan
		if (idealLeft + actualWidth > windowWidth - margin) {
			idealLeft = windowWidth - margin - actualWidth;
		}
		
		// Hitung offset relatif terhadap parent button container (rect.left)
		const relativeLeft = idealLeft - rect.left;
		
		setDropdownStyle({
			left: `${relativeLeft}px`,
			right: 'auto',
			width: `${actualWidth}px`,
		});
	}, []);

	useEffect(() => {
		fetchNotifications();

		// Close dropdown when clicking or touching outside
		function handleInteractionOutside(event) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		}
		document.addEventListener('mousedown', handleInteractionOutside);
		document.addEventListener('touchstart', handleInteractionOutside, { passive: true });
		return () => {
			document.removeEventListener('mousedown', handleInteractionOutside);
			document.removeEventListener('touchstart', handleInteractionOutside);
		};
	}, []);

	// Perbarui posisi saat dibuka atau saat ukuran layar / scroll berubah
	useEffect(() => {
		if (isOpen) {
			updatePosition();
			window.addEventListener('resize', updatePosition);
			window.addEventListener('scroll', updatePosition, true);
			return () => {
				window.removeEventListener('resize', updatePosition);
				window.removeEventListener('scroll', updatePosition, true);
			};
		}
	}, [isOpen, updatePosition]);

	const toggleOpen = () => {
		if (!isOpen) {
			updatePosition();
		}
		setIsOpen((prev) => !prev);
	};

	const fetchNotifications = async () => {
		try {
			setIsLoading(true);
			const res = await fetch('/api/notifikasi');
			if (res.ok) {
				const data = await res.json();
				setNotifications(data);
			}
		} catch (error) {
			console.error('Failed to fetch notifications:', error);
		} finally {
			setIsLoading(false);
		}
	};

	const markAsRead = async (id, actionUrl) => {
		try {
			// Optimistic UI update
			setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
			
			await fetch(`/api/notifikasi/${id}`, { method: 'PATCH' });
			
			setIsOpen(false);
			if (actionUrl) {
				window.location.href = actionUrl;
			}
		} catch (error) {
			console.error('Failed to mark as read:', error);
		}
	};

	const markAllAsRead = async () => {
		try {
			// Optimistic UI update
			setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
			await fetch('/api/notifikasi', { method: 'PATCH' });
		} catch (error) {
			console.error('Failed to mark all as read:', error);
		}
	};

	const formatDate = (dateString) => {
		const date = new Date(dateString);
		return new Intl.DateTimeFormat('id-ID', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		}).format(date);
	};

	return (
		<div className='relative flex-shrink-0' ref={dropdownRef}>
			<button
				onClick={toggleOpen}
				title='Notifikasi'
				className='relative p-3 neo-card flex items-center justify-center hover:bg-yellow-400 transition-all duration-200'>
				<svg
					className='w-6 h-6'
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
					/>
				</svg>
				{unreadCount > 0 && (
					<span className='absolute top-2 right-2 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white'>
						{/* If want to show number: unreadCount > 9 ? '9+' : unreadCount */}
					</span>
				)}
			</button>

			{/* Dropdown Menu */}
			{isOpen && (
				<div
					style={dropdownStyle}
					className='absolute top-full mt-2 sm:mt-3 neo-card p-0 overflow-hidden z-50 transition-all hover:translate-x-0 hover:translate-y-0'>
					<div className='p-3 sm:p-4 border-b-2 border-black flex items-center justify-between bg-yellow-50'>
						<div className='flex items-center gap-2'>
							<h3 className='font-black text-black text-base sm:text-lg uppercase tracking-wider'>Notifikasi</h3>
							{unreadCount > 0 && (
								<span className='bg-black text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-md'>
									{unreadCount} Baru
								</span>
							)}
						</div>
						<div className='flex items-center gap-1.5'>
							{unreadCount > 0 && (
								<button
									type='button'
									onClick={markAllAsRead}
									className='text-[10px] sm:text-xs font-bold text-black hover:bg-yellow-200 border-2 border-black px-2 py-1 rounded bg-white shadow-[1px_1px_0px_0px_#0D0D0D] active:translate-x-[1px] active:translate-y-[1px] transition-all'
									title='Tandai semua sudah dibaca'>
									✓ Tandai Dibaca
								</button>
							)}
							<button
								type='button'
								onClick={() => setIsOpen(false)}
								className='p-1 rounded-md hover:bg-black/10 transition-colors text-black'
								title='Tutup notifikasi'>
								<svg className='w-4 h-4 sm:w-5 sm:h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2.5} d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>
					</div>

					<div className='max-h-[60vh] overflow-y-auto overscroll-contain'>
						{isLoading ? (
							<div className='p-8 text-center'>
								<div className='animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mx-auto'></div>
							</div>
						) : notifications.length > 0 ? (
							<div className='divide-y divide-gray-100'>
								{notifications.map((notif) => (
									<div
										key={notif.id}
										onClick={() => markAsRead(notif.id, notif.action_url)}
										className={`p-3 sm:p-4 cursor-pointer hover:bg-yellow-50/80 border-b-2 border-black last:border-b-0 transition-colors flex gap-3 ${!notif.is_read ? 'bg-blue-50/80' : 'bg-white'}`}>
										<div className='flex-shrink-0 mt-0.5'>
											{notif.tipe === 'reminder_jurnal' ? (
												<div className='w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-black bg-yellow-400 text-black flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
												</div>
											) : (
												<div className='w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-black bg-blue-400 text-black flex items-center justify-center shadow-[2px_2px_0px_0px_#0D0D0D]'>
													<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
												</div>
											)}
										</div>
										<div className='flex-1 min-w-0'>
											<div className='flex justify-between items-start gap-2'>
												<h4 className={`text-xs sm:text-sm font-bold leading-snug break-words ${!notif.is_read ? 'text-gray-900 font-black' : 'text-gray-700'}`}>{notif.judul}</h4>
												{!notif.is_read && <span className='w-2 h-2 rounded-full bg-blue-600 mt-1 flex-shrink-0'></span>}
											</div>
											<p className='text-xs sm:text-sm text-gray-600 mt-1 leading-snug break-words'>{notif.pesan}</p>
											<p className='text-[10px] sm:text-xs text-gray-400 mt-1.5 font-medium'>{formatDate(notif.created_at)}</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='p-8 text-center text-gray-500'>
								<svg className='w-12 h-12 text-gray-300 mx-auto mb-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
								<p className='font-bold text-sm text-black'>Belum ada notifikasi</p>
								<p className='text-xs text-gray-500 mt-1'>Notifikasi dan pengingat akan muncul di sini</p>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
