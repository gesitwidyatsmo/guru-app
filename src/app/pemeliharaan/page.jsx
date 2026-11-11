import { getSchoolBranding } from '@/lib/schoolBranding';
import { getMaintenanceStatus } from '@/lib/maintenanceMode';
import PemeliharaanClient from './PemeliharaanClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
	title: 'Pemeliharaan Sistem — GuruApp',
	description: 'Sistem sedang dalam masa pemeliharaan dan peningkatan performa berkala.',
};

export default async function PemeliharaanPage() {
	const [branding, maintenance] = await Promise.all([
		getSchoolBranding(),
		getMaintenanceStatus(true),
	]);

	return <PemeliharaanClient initialBranding={branding} initialMaintenance={maintenance} />;
}
