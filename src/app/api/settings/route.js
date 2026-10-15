import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const DEFAULT_GEOFENCE = {
	enabled: false,
	lat: -6.200000,
	lng: 106.816666,
	radius: 200,
	nama_lokasi: 'Area Sekolah',
	berlaku_untuk: ['jurnal'],
};

// GET — Ambil pengaturan aplikasi berdasarkan key atau semua
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const key = searchParams.get('key');

		const supabase = await createClient();

		if (key) {
			const { data, error } = await supabase
				.from('app_settings')
				.select('*')
				.eq('key', key)
				.maybeSingle();

			if (error) {
				// Fallback jika tabel app_settings belum dibuat di Supabase
				if (error.code === '42P01' || error.message?.includes('does not exist')) {
					console.warn('⚠️ Tabel app_settings belum ada. Menggunakan nilai default untuk key:', key);
					if (key === 'geofence') {
						return NextResponse.json({ key: 'geofence', value: DEFAULT_GEOFENCE, _fallback: true });
					}
					return NextResponse.json({ key, value: null, _fallback: true });
				}
				throw error;
			}

			if (!data && key === 'geofence') {
				return NextResponse.json({ key: 'geofence', value: DEFAULT_GEOFENCE, _seeded: false });
			}

			return NextResponse.json(data || { key, value: null });
		}

		// Jika tanpa parameter key, ambil semua pengaturan
		const { data, error } = await supabase.from('app_settings').select('*');
		if (error) {
			if (error.code === '42P01' || error.message?.includes('does not exist')) {
				return NextResponse.json([{ key: 'geofence', value: DEFAULT_GEOFENCE, _fallback: true }]);
			}
			throw error;
		}

		return NextResponse.json(data || []);
	} catch (error) {
		console.error('❌ GET settings error:', error);
		return NextResponse.json({ error: 'Gagal memuat pengaturan aplikasi' }, { status: 500 });
	}
}

// PUT — Perbarui pengaturan aplikasi (Khusus Admin)
export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses ditolak: Hanya Administrator yang dapat mengubah pengaturan.' }, { status: 403 });
		}

		const body = await req.json();
		const { key, value } = body;

		if (!key || value === undefined) {
			return NextResponse.json({ error: 'Parameter "key" dan "value" wajib diisi.' }, { status: 400 });
		}

		// Gunakan supabaseAdmin untuk memastikan bypass RLS jika diperlukan saat upsert setting
		const client = supabaseAdmin || (await createClient());

		const { data, error } = await client
			.from('app_settings')
			.upsert(
				{
					key,
					value,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'key' }
			)
			.select()
			.single();

		if (error) {
			if (error.code === '42P01' || error.message?.includes('does not exist')) {
				return NextResponse.json(
					{
						error: 'Tabel "app_settings" belum dibuat di Supabase. Silakan jalankan file migrasi migrations/add_app_settings_geofence.sql terlebih dahulu di SQL Editor Supabase.',
						missingTable: true,
					},
					{ status: 500 }
				);
			}
			throw error;
		}

		return NextResponse.json({ success: true, setting: data }, { status: 200 });
	} catch (error) {
		console.error('❌ PUT settings error:', error);
		return NextResponse.json({ error: 'Gagal menyimpan pengaturan aplikasi: ' + (error.message || error) }, { status: 500 });
	}
}
