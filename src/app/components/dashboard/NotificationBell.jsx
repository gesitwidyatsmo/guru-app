'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function NotificationBell() {
	const [notifications, setNotifications] = useState([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const dropdownRef = useRef(null);

	const unreadCount = notifications.filter((n) => !n.is_read).length;

	useEffect(() => {
		fetchNotifications();

		// Close dropdown when clicking outside
		function handleClickOutside(event) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

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
				onClick={() => setIsOpen(!isOpen)}
				title='Notifikasi'
				className='relative p-3 rounded-2xl bg-white shadow-md hover:shadow-lg border border-gray-100 text-gray-500 hover:text-indigo-600 hover:border-indigo-200 transition-all duration-200'>
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
				<div className='absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 transform origin-top-right transition-all'>
					<div className='p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50'>
						<h3 className='font-bold text-gray-800 text-lg'>Notifikasi</h3>
						{unreadCount > 0 && <span className='bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md'>{unreadCount} Baru</span>}
					</div>

					<div className='max-h-[60vh] overflow-y-auto'>
						{isLoading ? (
							<div className='p-8 text-center'>
								<div className='animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent mx-auto'></div>
							</div>
						) : notifications.length > 0 ? (
							<div className='divide-y divide-gray-50'>
								{notifications.map((notif) => (
									<div
										key={notif.id}
										onClick={() => markAsRead(notif.id, notif.action_url)}
										className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors flex gap-4 ${!notif.is_read ? 'bg-indigo-50/30' : ''}`}>
										<div className='flex-shrink-0 mt-1'>
											{notif.tipe === 'reminder_jurnal' ? (
												<div className='w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center'>
													<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
												</div>
											) : (
												<div className='w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center'>
													<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
												</div>
											)}
										</div>
										<div className='flex-1'>
											<div className='flex justify-between items-start gap-2'>
												<h4 className={`text-sm font-bold ${!notif.is_read ? 'text-gray-900' : 'text-gray-700'}`}>{notif.judul}</h4>
												{!notif.is_read && <span className='w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0'></span>}
											</div>
											<p className='text-sm text-gray-600 mt-1 leading-snug'>{notif.pesan}</p>
											<p className='text-xs text-gray-400 mt-2 font-medium'>{formatDate(notif.created_at)}</p>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='p-8 text-center text-gray-500'>
								<svg className='w-12 h-12 text-gray-300 mx-auto mb-3' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
								<p className='font-medium'>Belum ada notifikasi</p>
								<p className='text-sm text-gray-400 mt-1'>Notifikasi dan pengingat akan muncul di sini</p>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
