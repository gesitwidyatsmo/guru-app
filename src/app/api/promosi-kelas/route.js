import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// POST - Promosi kelas siswa (massal atau per-siswa)
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		if (role !== 'Admin') {
			return NextResponse.json({ error: 'Akses ditolak: khusus Admin' }, { status: 403 });
		}

		const body = await req.json();
		const { mode, items } = body;
		// mode: 'massal' | 'individual'
		// items massal: [{ dari_kelas: '7A', ke_kelas: '8A' }, ...]
		//   → update semua siswa di dari_kelas ke ke_kelas
		// items individual: [{ siswa_id: 'xxx', ke_kelas: '8A' | 'Lulus' }, ...]

		if (!mode || !Array.isArray(items) || items.length === 0) {
			return NextResponse.json({ error: 'mode dan items wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		let totalUpdated = 0;

		if (mode === 'massal') {
			for (const item of items) {
				const { dari_kelas, ke_kelas } = item;
				if (!dari_kelas || !ke_kelas) continue;

				if (ke_kelas === 'Lulus') {
					// Set status Lulus, kelas tetap (historis)
					const { data, error } = await supabase
						.from('siswa')
						.update({ status: 'Lulus' })
						.eq('kelas', dari_kelas)
						.eq('status', 'Aktif')
						.select('id');
					if (!error && data) totalUpdated += data.length;
				} else {
					// Pindah kelas
					const { data, error } = await supabase
						.from('siswa')
						.update({ kelas: ke_kelas })
						.eq('kelas', dari_kelas)
						.eq('status', 'Aktif')
						.select('id');
					if (!error && data) totalUpdated += data.length;
				}
			}
		} else if (mode === 'individual') {
			for (const item of items) {
				const { siswa_id, nis, ke_kelas } = item;
				if ((!siswa_id && !nis) || !ke_kelas) continue;

				const validStatuses = ['Lulus', 'Pindah', 'Boyong', 'Non-Aktif'];
				const isStatusChange = validStatuses.includes(ke_kelas);

				let query = supabase.from('siswa').update(
					isStatusChange
						? { status: ke_kelas }
						: { kelas: ke_kelas, status: 'Aktif' }
				);

				if (siswa_id) {
					query = query.eq('id', siswa_id);
				} else if (nis) {
					query = query.eq('nis', String(nis));
				}

				const { error } = await query;
				if (!error) totalUpdated++;
			}
		} else {
			return NextResponse.json({ error: 'mode tidak valid. Gunakan massal atau individual' }, { status: 400 });
		}

		return NextResponse.json({
			success: true,
			message: `Promosi/penjurusan kelas berhasil: ${totalUpdated} siswa diperbarui`,
			total: totalUpdated,
		});
	} catch (error) {
		console.error('POST promosi-kelas error:', error);
		return NextResponse.json({ error: 'Gagal memproses promosi kelas' }, { status: 500 });
	}
}
