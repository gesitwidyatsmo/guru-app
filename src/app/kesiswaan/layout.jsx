import { headers, cookies } from 'next/headers';
import KesiswaanLayoutClient from './KesiswaanLayoutClient';

export default async function KesiswaanLayout({ children }) {
	const headersList = await headers();
	const cookieStore = await cookies();

	const initialRole = headersList.get('x-user-role') || cookieStore.get('user_role')?.value || 'Kesiswaan';
	const rawName = headersList.get('x-user-name') || cookieStore.get('user_name')?.value;
	const initialName = rawName ? decodeURIComponent(rawName) : 'Staf Kesiswaan';

	return (
		<KesiswaanLayoutClient initialRole={initialRole} initialName={initialName}>
			{children}
		</KesiswaanLayoutClient>
	);
}
