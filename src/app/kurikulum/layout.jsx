import { headers, cookies } from 'next/headers';
import KurikulumLayoutClient from './KurikulumLayoutClient';

export default async function KurikulumLayout({ children }) {
	const headersList = await headers();
	const cookieStore = await cookies();

	const initialRole = headersList.get('x-user-role') || cookieStore.get('user_role')?.value || 'Kurikulum';
	const rawName = headersList.get('x-user-name') || cookieStore.get('user_name')?.value;
	const initialName = rawName ? decodeURIComponent(rawName) : 'Waka Kurikulum';

	return (
		<KurikulumLayoutClient initialRole={initialRole} initialName={initialName}>
			{children}
		</KurikulumLayoutClient>
	);
}
