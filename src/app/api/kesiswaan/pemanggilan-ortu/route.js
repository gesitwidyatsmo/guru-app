import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const filterStatus = searchParams.get('status');
		const search = searchParams.get('search');

		let query = supabaseAdmin
			.from('kesiswaan_pemanggilan_ortu')
			.select(`
				id,
				penanganan_id,
				siswa_id,
				nomor_surat,
				tanggal_pemanggilan,
				waktu_pemanggilan,
				tempat,
				alasan_pemanggilan,
				status,
				catatan_hasil_pertemuan,
				komitmen_ortu_santri,
				diterbitkan_oleh,
				created_at,
				updated_at
			`)
			.order('tanggal_pemanggilan', { ascending: false });

		if (filterStatus && filterStatus !== 'Semua') {
			query = query.eq('status', filterStatus);
		}

		const { data: rawList, error } = await query;
		if (error) {
			console.error('Error fetching pemanggilan ortu:', error);
			return NextResponse.json({
				success: false,
				error: error.message,
				pemanggilanList: [],
				summary: { total: 0, dijadwalkan: 0, hadir: 0, reschedule: 0, selesai: 0 },
			});
		}

		let pemanggilanList = rawList || [];

		// Ambil data siswa untuk enrich nama, kelas, no_telp ortu
		const siswaIds = [...new Set(pemanggilanList.map((p) => p.siswa_id))];
		let siswaMap = new Map();
		if (siswaIds.length > 0) {
			const { data: siswaData } = await supabaseAdmin
				.from('siswa')
				.select('id, nama_lengkap, kelas, nis')
				.in('id', siswaIds);

			(siswaData || []).forEach((s) => siswaMap.set(String(s.id), s));
		}

		// Enrich data
		pemanggilanList = pemanggilanList.map((item) => {
			const siswa = siswaMap.get(String(item.siswa_id)) || {};
			return {
				...item,
				nama_lengkap: siswa.nama_lengkap || 'Siswa',
				kelas: siswa.kelas || '—',
				nis: siswa.nis || '—',
			};
		});

		if (search && search.trim() !== '') {
			const s = search.toLowerCase();
			pemanggilanList = pemanggilanList.filter(
				(item) =>
					(item.nama_lengkap && item.nama_lengkap.toLowerCase().includes(s)) ||
					(item.kelas && item.kelas.toLowerCase().includes(s)) ||
					(item.nomor_surat && item.nomor_surat.toLowerCase().includes(s))
			);
		}

		const summary = {
			total: pemanggilanList.length,
			dijadwalkan: pemanggilanList.filter((p) => p.status === 'Dijadwalkan').length,
			hadir: pemanggilanList.filter((p) => p.status === 'Hadir').length,
			reschedule: pemanggilanList.filter((p) => p.status === 'Reschedule').length,
			selesai: pemanggilanList.filter((p) => p.status === 'Selesai').length,
		};

		return NextResponse.json({
			success: true,
			pemanggilanList,
			summary,
		});
	} catch (err) {
		console.error('API Pemanggilan Ortu GET Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function POST(req) {
	try {
		const body = await req.json();
		const {
			penanganan_id,
			siswa_id,
			nomor_surat,
			tanggal_pemanggilan,
			waktu_pemanggilan,
			tempat,
			alasan_pemanggilan,
			diterbitkan_oleh,
		} = body;

		if (!siswa_id || !tanggal_pemanggilan || !alasan_pemanggilan) {
			return NextResponse.json(
				{ error: 'Siswa, Tanggal Pemanggilan, dan Alasan Pemanggilan wajib diisi' },
				{ status: 400 }
			);
		}

		// Generate nomor surat default jika tidak ada
		const countResult = await supabaseAdmin
			.from('kesiswaan_pemanggilan_ortu')
			.select('id', { count: 'exact', head: true });
		const nextNum = (countResult.count || 0) + 1;
		const romanMonth = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][
			new Date().getMonth()
		];
		const year = new Date().getFullYear();
		const generatedNoSurat =
			nomor_surat?.trim() ||
			`${String(nextNum).padStart(3, '0')}/KESISWAAN/SMP/${romanMonth}/${year}`;

		const newRecord = {
			penanganan_id: penanganan_id ? Number(penanganan_id) : null,
			siswa_id: String(siswa_id),
			nomor_surat: generatedNoSurat,
			tanggal_pemanggilan,
			waktu_pemanggilan: waktu_pemanggilan || '09:00 WIB',
			tempat: tempat || 'Ruang Kesiswaan / BK',
			alasan_pemanggilan,
			status: 'Dijadwalkan',
			diterbitkan_oleh: diterbitkan_oleh || 'Kesiswaan',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		const { data, error } = await supabaseAdmin
			.from('kesiswaan_pemanggilan_ortu')
			.insert([newRecord])
			.select()
			.single();

		if (error) {
			console.error('Error insert pemanggilan ortu:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		// Jika terhubung dengan tiket penanganan santri, perbarui statusnya
		if (penanganan_id) {
			await supabaseAdmin
				.from('kesiswaan_penanganan_santri')
				.update({
					status: 'Perlu Panggilan Orang Tua',
					rekomendasi_tindak_lanjut: 'Panggilan Orang Tua',
					updated_at: new Date().toISOString(),
				})
				.eq('id', penanganan_id);
		}

		return NextResponse.json({
			success: true,
			message: 'Surat pemanggilan orang tua berhasil diterbitkan.',
			data,
		});
	} catch (err) {
		console.error('API Pemanggilan Ortu POST Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		const body = await req.json();
		const { id, ...updates } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID pemanggilan orang tua diperlukan' }, { status: 400 });
		}

		updates.updated_at = new Date().toISOString();

		const { data, error } = await supabaseAdmin
			.from('kesiswaan_pemanggilan_ortu')
			.update(updates)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('Error update pemanggilan ortu:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: 'Data pemanggilan orang tua berhasil diperbarui.',
			data,
		});
	} catch (err) {
		console.error('API Pemanggilan Ortu PUT Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}

export async function DELETE(req) {
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID pemanggilan orang tua diperlukan' }, { status: 400 });
		}

		const { error } = await supabaseAdmin
			.from('kesiswaan_pemanggilan_ortu')
			.delete()
			.eq('id', id);

		if (error) {
			console.error('Error delete pemanggilan ortu:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		return NextResponse.json({
			success: true,
			message: 'Data pemanggilan orang tua berhasil dihapus.',
		});
	} catch (err) {
		console.error('API Pemanggilan Ortu DELETE Error:', err);
		return NextResponse.json({ error: err.message }, { status: 500 });
	}
}
