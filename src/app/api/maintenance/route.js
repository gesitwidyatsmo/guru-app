import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { getMaintenanceStatus, setCachedMaintenanceStatus } from '@/lib/maintenanceMode';

// GET: Ambil status pemeliharaan saat ini (Akses Publik agar halaman pemeliharaan bisa polling)
export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const refresh = searchParams.get('refresh') === '1';
		const status = await getMaintenanceStatus(refresh);
		return NextResponse.json(status);
	} catch (error) {
		console.error('❌ GET /api/maintenance error:', error);
		return NextResponse.json(
			{ error: 'Gagal memuat status pemeliharaan' },
			{ status: 500 }
		);
	}
}

// POST/PUT: Mengubah status pemeliharaan (Khusus Admin)
export async function POST(req) {
	try {
		const supabase = await createClient();
		let role = req.headers.get('x-user-role') || req.cookies.get('user_role')?.value;
		let userName = req.headers.get('x-user-name') ? decodeURIComponent(req.headers.get('x-user-name')) : '';

		if (!role) {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: userProfile } = await supabaseAdmin
					.from('users')
					.select('role, nama_lengkap')
					.eq('auth_id', user.id)
					.maybeSingle();
				role = userProfile?.role;
				userName = userProfile?.nama_lengkap || '';
			}
		}

		if (role !== 'Admin') {
			return NextResponse.json(
				{ error: 'Akses ditolak: Hanya Administrator yang dapat mengubah status pemeliharaan sistem.' },
				{ status: 403 }
			);
		}

		const body = await req.json();
		const currentStatus = await getMaintenanceStatus(true);

		const updatedValue = {
			enabled: typeof body.enabled === 'boolean' ? body.enabled : currentStatus.enabled,
			pesan: body.pesan !== undefined ? String(body.pesan).trim() : currentStatus.pesan,
			estimasi_selesai: body.estimasi_selesai !== undefined ? String(body.estimasi_selesai).trim() : currentStatus.estimasi_selesai,
			kontak_bantuan: body.kontak_bantuan !== undefined ? String(body.kontak_bantuan).trim() : currentStatus.kontak_bantuan,
			allow_admin_bypass: body.allow_admin_bypass !== false,
			updated_at: new Date().toISOString(),
			updated_by: userName || 'Administrator',
		};

		const { data, error } = await supabaseAdmin
			.from('app_settings')
			.upsert(
				{
					key: 'maintenance_mode',
					value: updatedValue,
					updated_at: new Date().toISOString(),
				},
				{ onConflict: 'key' }
			)
			.select()
			.single();

		if (error) {
			throw error;
		}

		// Perbarui in-memory cache seketika
		setCachedMaintenanceStatus(updatedValue);

		return NextResponse.json({
			success: true,
			message: updatedValue.enabled
				? 'Mode Pemeliharaan BERHASIL DIAKTIFKAN. Seluruh website dikunci.'
				: 'Mode Pemeliharaan BERHASIL DINONAKTIFKAN. Website kembali normal.',
			maintenance: updatedValue,
		});
	} catch (error) {
		console.error('❌ POST /api/maintenance error:', error);
		return NextResponse.json(
			{ error: 'Gagal memperbarui status pemeliharaan: ' + (error.message || error) },
			{ status: 500 }
		);
	}
}

export async function PUT(req) {
	return POST(req);
}
