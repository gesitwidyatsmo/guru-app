import { headers, cookies } from 'next/headers';
import AdminLayoutClient from './AdminLayoutClient';

export default async function AdminLayout({ children }) {
	const headersList = await headers();
	const cookieStore = await cookies();

	const initialRole = headersList.get('x-user-role') || cookieStore.get('user_role')?.value || null;
	const rawName = headersList.get('x-user-name') || cookieStore.get('user_name')?.value;
	const initialName = rawName
		? decodeURIComponent(rawName)
		: initialRole === 'Kepala Sekolah'
		? 'Kepala Sekolah'
		: 'Administrator';

	return (
		<AdminLayoutClient initialRole={initialRole} initialName={initialName}>
			{children}
		</AdminLayoutClient>
	);
}
