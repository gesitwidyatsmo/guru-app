import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { checkJamOverlap } from '@/lib/absensiUtils';

export async function POST(req) {
	try {
		const supabase = await createClient();
		let userId = req.headers.get('x-user-id') || req.cookies.get('user_id')?.value;
		let userRole = req.headers.get('x-user-role') || req.cookies.get('user_role')?.value;

		if (!userId || !userRole) {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: profile } = await supabaseAdmin
					.from('users')
					.select('id_user, role')
					.eq('auth_id', user.id)
					.maybeSingle();
				if (profile) {
					userId = profile.id_user;
					userRole = profile.role;
				}
			}
		}

		if (!userId) {
			return NextResponse.json({ error: 'Harap login terlebih dahulu.' }, { status: 401 });
		}

		const body = await req.json();
		const { id } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID Jurnal wajib disertakan.' }, { status: 400 });
		}

		// 1. Ambil data draft jurnal KBM
		const { data: journal, error: fetchErr } = await supabaseAdmin
			.from('jurnal')
			.select('*, users!jurnal_guru_id_fkey(nama_lengkap)')
			.eq('id', id)
			.maybeSingle();

		if (fetchErr || !journal) {
			return NextResponse.json({ error: 'Data Jurnal tidak ditemukan.' }, { status: 404 });
		}

		// Pastikan hanya pemilik jurnal atau Admin/Kurikulum yang bisa mengesahkan
		const isOwner = journal.guru_id === userId;
		const isAdmin = userRole === 'Admin' || userRole === 'Kurikulum' || userRole === 'Kepala Sekolah';

		if (!isOwner && !isAdmin) {
			return NextResponse.json({ error: 'Akses Ditolak: Anda bukan pemilik jurnal ini.' }, { status: 403 });
		}

		// 2. Ambil KBM aktif di kelas & tanggal yang sama untuk memastikan jam benar-benar bebas
		const { data: classJournals } = await supabaseAdmin
			.from('jurnal')
			.select('id, jam_ke, mapel, guru_id, status_verifikasi, status_kehadiran, users!jurnal_guru_id_fkey(nama_lengkap)')
			.eq('kelas', journal.kelas)
			.eq('tanggal', journal.tanggal)
			.neq('id', journal.id);

		const activeJournals = (classJournals || []).filter(
			(j) => j.status_verifikasi !== 'draft_bentrok' && !String(j.status_kehadiran || '').toLowerCase().includes('draft bentrok')
		);

		const activeOverlap = activeJournals.find((j) => checkJamOverlap(j.jam_ke, journal.jam_ke).isOverlap);

		if (activeOverlap) {
			const guruExisting = activeOverlap.users?.nama_lengkap || 'Guru lain';
			return NextResponse.json(
				{
					error: `Slot Jam ke-${journal.jam_ke} belum bebas. Masih bertabrakan dengan KBM ${activeOverlap.mapel} oleh ${guruExisting} (Jam ${activeOverlap.jam_ke}). Silakan koordinasikan dengan guru terkait atau hubungi Admin.`,
					conflict: {
						existingJamKe: activeOverlap.jam_ke,
						existingGuru: guruExisting,
					},
				},
				{ status: 409 }
			);
		}

		// 3. Jika slot jam benar-benar sudah bebas: Sahkan jurnal seketika!
		const nowStr = new Date().toLocaleString('id-ID');
		const guruName = journal.users?.nama_lengkap || 'Guru';
		const approvePayload = {
			status_verifikasi: 'disetujui',
			status_kehadiran: 'Normal',
			catatan_admin: `Disahkan mandiri oleh ${guruName} pada ${nowStr} (Slot jam telah dibebaskan mandiri oleh guru terkait).`,
		};

		const { error: updErr } = await supabaseAdmin.from('jurnal').update(approvePayload).eq('id', id);
		if (updErr) throw updErr;

		return NextResponse.json({
			success: true,
			message: `Alhamdulillah! Slot Jam ke-${journal.jam_ke} sudah bebas. Jurnal KBM ${journal.mapel} kelas ${journal.kelas} berhasil disahkan dan hak Bisaroh telah aktif.`,
		});
	} catch (error) {
		console.error('Error POST /api/jurnal/claim-freed:', error);
		return NextResponse.json({ error: error.message || 'Terjadi kesalahan sistem saat mengesahkan jurnal.' }, { status: 500 });
	}
}
