import fs from 'fs';
import path from 'path';
import { getSchoolBranding } from '@/lib/schoolBranding';

export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		// 1. Ambil logo dari database (menggunakan in-memory cache dari schoolBranding)
		const branding = await getSchoolBranding();
		const logoData = branding?.logo;

		if (logoData && typeof logoData === 'string' && logoData.startsWith('data:image/')) {
			const matches = logoData.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
			if (matches && matches.length === 3) {
				const contentType = matches[1];
				const buffer = Buffer.from(matches[2], 'base64');

				return new Response(buffer, {
					status: 200,
					headers: {
						'Content-Type': contentType,
						'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
					},
				});
			}
		}

		// 2. Fallback jika di database belum ada logo / tidak ada settingan: tetap gunakan logo GWA
		const fallbackCandidates = [
			path.join(process.cwd(), 'public', 'logo gwa.png'),
			path.join(process.cwd(), 'public', 'logo smp.png'),
			path.join(process.cwd(), 'public', 'logo_kiri.png'),
		];

		for (const filePath of fallbackCandidates) {
			if (fs.existsSync(filePath)) {
				const buffer = fs.readFileSync(filePath);
				return new Response(buffer, {
					status: 200,
					headers: {
						'Content-Type': 'image/png',
						'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
					},
				});
			}
		}

		return new Response('Logo not found', { status: 404 });
	} catch (err) {
		console.error('Error serving app icon:', err);
		return new Response('Internal Server Error', { status: 500 });
	}
}
