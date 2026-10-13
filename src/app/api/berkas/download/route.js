import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const BUCKET_NAME = 'public-files';

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const name = searchParams.get('name');
		const rawFilename = searchParams.get('filename') || name || 'download';

		if (!name) {
			return NextResponse.json({ error: 'Parameter berkas tidak valid' }, { status: 400 });
		}

		// Unduh file buffer dari Supabase Storage
		const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(name);

		if (error || !data) {
			console.error('Download error from storage:', error);
			return NextResponse.json({ error: 'Berkas tidak ditemukan atau telah dihapus' }, { status: 404 });
		}

		const arrayBuffer = await data.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Sanitasi nama file untuk header Content-Disposition
		const safeFilename = encodeURIComponent(rawFilename).replace(/['()]/g, escape);

		return new NextResponse(buffer, {
			status: 200,
			headers: {
				'Content-Type': data.type || 'application/octet-stream',
				'Content-Disposition': `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`,
				'Content-Length': buffer.length.toString(),
				'Cache-Control': 'no-cache',
			},
		});
	} catch (err) {
		console.error('API Berkas Download error:', err);
		return NextResponse.json({ error: err.message || 'Gagal mengunduh berkas' }, { status: 500 });
	}
}
