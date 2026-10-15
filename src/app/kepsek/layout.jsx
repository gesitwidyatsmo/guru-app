import { headers, cookies } from 'next/headers';
import KepsekLayoutClient from './KepsekLayoutClient';

export default async function KepsekLayout({ children }) {
	const headersList = await headers();
	const cookieStore = await cookies();

	const initialRole = headersList.get('x-user-role') || cookieStore.get('user_role')?.value || 'Kepala Sekolah';
	const rawName = headersList.get('x-user-name') || cookieStore.get('user_name')?.value;
	const initialName = rawName ? decodeURIComponent(rawName) : 'Kepala Sekolah';

	return (
		<KepsekLayoutClient initialRole={initialRole} initialName={initialName}>
			{children}
		</KepsekLayoutClient>
	);
}
