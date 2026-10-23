import { getSchoolBranding } from '@/lib/schoolBranding';
import LoginClient from './LoginClient';

export default async function LoginPage() {
	const initialBranding = await getSchoolBranding();
	return <LoginClient initialBranding={initialBranding} />;
}
