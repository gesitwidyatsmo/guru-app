'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getUserSession, saveUserSession } from '@/lib/offlineDb';

const LOCAL_STORAGE_SESSION_KEY = 'guruapp_user_session';

/**
 * Offline-safe authentication hook.
 * Fetches current user from `/api/auth/me` when online and caches it.
 * When offline, gracefully falls back to cached session without kicking the user to /login.
 */
export function useCurrentUser(options = { redirectIfUnauthenticated: false }) {
	const router = useRouter();
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isOfflineSession, setIsOfflineSession] = useState(false);

	useEffect(() => {
		let isMounted = true;

		const loadUser = async () => {
			// 1. Try to load from fast local storage / IndexedDB first
			let cachedUser = null;
			try {
				const idbUser = await getUserSession();
				if (idbUser) {
					cachedUser = idbUser;
				} else {
					const lsRaw = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
					if (lsRaw) cachedUser = JSON.parse(lsRaw);
				}

				if (cachedUser && isMounted) {
					setUser(cachedUser);
				}
			} catch (e) {
				console.warn('Error reading cached user session:', e);
			}

			// 2. If online, verify and update cache from `/api/auth/me`
			if (typeof window !== 'undefined' && window.navigator.onLine) {
				try {
					const res = await fetch('/api/auth/me');
					if (res.ok) {
						const data = await res.json();
						if (data.user && isMounted) {
							setUser(data.user);
							setIsOfflineSession(false);
							// Update storage
							saveUserSession(data.user);
							localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(data.user));
						}
					} else if (res.status === 401 && options.redirectIfUnauthenticated && isMounted) {
						localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
						router.push('/login');
						return;
					}
				} catch (err) {
					// Network error while online check -> use offline session
					if (cachedUser && isMounted) {
						setIsOfflineSession(true);
					}
				}
			} else {
				// Offline mode
				if (cachedUser && isMounted) {
					setIsOfflineSession(true);
				} else if (options.redirectIfUnauthenticated && isMounted) {
					router.push('/login');
					return;
				}
			}

			if (isMounted) {
				setLoading(false);
			}
		};

		loadUser();

		return () => {
			isMounted = false;
		};
	}, [options.redirectIfUnauthenticated, router]);

	return {
		user,
		userId: user?.id || user?.id_user || '',
		userRole: user?.role || '',
		userName: user?.nama_lengkap || user?.username || '',
		loading,
		isOfflineSession,
	};
}
