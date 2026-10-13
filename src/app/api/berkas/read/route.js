import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const BUCKET_NAME = 'public-files';

export async function GET(request) {
	try {
		const { searchParams } = new URL(request.url);
		const name = searchParams.get('name');

		if (!name) {
			return NextResponse.json({ error: 'Parameter berkas tidak valid' }, { status: 400 });
		}

		// Download file stream dari Supabase Storage
		const { data, error } = await supabaseAdmin.storage.from(BUCKET_NAME).download(name);

		if (error || !data) {
			return NextResponse.json({ error: 'Berkas tidak ditemukan' }, { status: 404 });
		}

		const textContent = await data.text();

		return NextResponse.json({
			success: true,
			content: textContent,
			type: data.type || 'text/plain',
			size: data.size || textContent.length,
		});
	} catch (err) {
		console.error('API Berkas Read error:', err);
		return NextResponse.json({ error: err.message || 'Gagal membaca isi berkas' }, { status: 500 });
	}
}
