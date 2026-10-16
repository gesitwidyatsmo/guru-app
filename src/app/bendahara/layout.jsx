import { headers, cookies } from 'next/headers';
import BendaharaLayoutClient from './BendaharaLayoutClient';

export default async function BendaharaLayout({ children }) {
	const headersList = await headers();
	const cookieStore = await cookies();

	const initialRole = headersList.get('x-user-role') || cookieStore.get('user_role')?.value || 'Bendahara';
	const rawName = headersList.get('x-user-name') || cookieStore.get('user_name')?.value;
	const initialName = rawName ? decodeURIComponent(rawName) : 'Bendahara Sekolah';

	return (
		<BendaharaLayoutClient initialRole={initialRole} initialName={initialName}>
			{children}
		</BendaharaLayoutClient>
	);
}
