import { headers, cookies } from 'next/headers';
import { supabaseAdmin } from '@/utils/supabase/admin';
import ERaporLayoutClient from './ERaporLayoutClient';

export default async function ERaporLayout({ children }) {
	const headersList = await headers();
	const cookieStore = await cookies();

	const initialRole = headersList.get('x-user-role') || cookieStore.get('user_role')?.value || 'Guru';
	const userId = headersList.get('x-user-id') || null;
	const rawName = headersList.get('x-user-name') || cookieStore.get('user_name')?.value;
	const initialName = rawName ? decodeURIComponent(rawName) : '';

	let initialIsWaliKelas = false;

	// Cek status Wali Kelas langsung di server secara instan
	if (userId) {
		try {
			const { data: waliCheck } = await supabaseAdmin
				.from('kelas')
				.select('id')
				.eq('id_wali_kelas', userId)
				.limit(1);

			if (waliCheck && waliCheck.length > 0) {
				initialIsWaliKelas = true;
			} else {
				const { data: relasiWali } = await supabaseAdmin
					.from('wali_kelas')
					.select('id')
					.eq('user_id', userId)
					.eq('is_active', true)
					.limit(1);
				if (relasiWali && relasiWali.length > 0) {
					initialIsWaliKelas = true;
				}
			}
		} catch (err) {
			console.error('Error server-side wali check:', err);
		}
	}

	return (
		<ERaporLayoutClient
			initialRole={initialRole}
			initialIsWaliKelas={initialIsWaliKelas}
			initialName={initialName}
			userId={userId}>
			{children}
		</ERaporLayoutClient>
	);
}
