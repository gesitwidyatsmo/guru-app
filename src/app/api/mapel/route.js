import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const generateId = (name = '') => {
	const clean = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
	const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
	return clean ? `MP-${clean}` : `MP-${randomSuffix}`;
};

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const role = request.headers.get('x-user-role');
		const userId = request.headers.get('x-user-id');
		const { searchParams } = new URL(request.url);
		const showAll = searchParams.get('all') === 'true';
		const kelasParam = searchParams.get('kelas');

		let allowedMapels = null;

		const isPrivileged = showAll || role === 'Admin' || role === 'Kepala Sekolah' || role === 'Kurikulum';

		if (kelasParam) {
			if (isPrivileged) {
				const { data: kbmData } = await supabase
					.from('guru_kbm')
					.select('mapel')
					.eq('kelas', kelasParam);
				if (kbmData && kbmData.length > 0) {
					allowedMapels = [...new Set(kbmData.map((r) => r.mapel).filter(Boolean))];
				} else {
					allowedMapels = null; // fallback jika belum ada data KBM spesifik
				}
			} else if (role === 'Guru' && userId) {
				// Cek apakah guru adalah Wali Kelas untuk kelas ini
				const { data: waliClass } = await supabase
					.from('kelas')
					.select('id')
					.eq('nama_kelas', kelasParam)
					.eq('id_wali_kelas', userId)
					.maybeSingle();

				if (waliClass) {
					// Wali Kelas dapat melihat semua mapel di kelas binaannya
					const { data: kbmData } = await supabase
						.from('guru_kbm')
						.select('mapel')
						.eq('kelas', kelasParam);
					allowedMapels = kbmData ? [...new Set(kbmData.map((r) => r.mapel).filter(Boolean))] : [];
				} else {
					// Guru mapel hanya dapat melihat mapel yang diajarkannya di kelas ini
					const { data: kbmData } = await supabase
						.from('guru_kbm')
						.select('mapel')
						.eq('kelas', kelasParam)
						.eq('id_user', userId);
					allowedMapels = kbmData ? [...new Set(kbmData.map((r) => r.mapel).filter(Boolean))] : [];
				}
			} else {
				allowedMapels = [];
			}
		} else {
			if (isPrivileged) {
				allowedMapels = null; // Semua mapel
			} else if (role === 'Guru' && userId) {
				const { data: kbmData } = await supabase
					.from('guru_kbm')
					.select('mapel')
					.eq('id_user', userId);

				if (kbmData) {
					allowedMapels = [...new Set(kbmData.map((r) => r.mapel).filter(Boolean))];
				} else {
					allowedMapels = [];
				}
			} else {
				allowedMapels = [];
			}
		}

		let query = supabase.from('mapel').select('id, mapel').order('mapel', { ascending: true });

		if (allowedMapels !== null) {
			if (allowedMapels.length === 0) {
				return NextResponse.json([]); // No mapel allowed
			}
			query = query.in('mapel', allowedMapels);
		}

		const { data: mapelData, error } = await query;

		if (error) throw error;

		let result = mapelData || [];
		if (allowedMapels !== null && allowedMapels.length > 0) {
			const existingNames = new Set(result.map((r) => r.mapel));
			for (const m of allowedMapels) {
				if (!existingNames.has(m)) {
					result.push({ id: `MP-${m.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}`, mapel: m });
				}
			}
		}

		return NextResponse.json(result);
	} catch (error) {
		console.error('Error GET Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	const role = request.headers.get('x-user-role');
	if (role && role !== 'Admin' && role !== 'Kurikulum' && role !== 'Kepala Sekolah') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin & Kurikulum)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { id, mapel } = body;

		if (!mapel || !mapel.trim()) {
			return NextResponse.json({ error: 'Nama mata pelajaran wajib diisi' }, { status: 400 });
		}

		const supabase = supabaseAdmin || (await createClient());

		// Tentukan ID yang unik
		let newId = id?.trim() || generateId(mapel.trim());
		const { data: existingWithId } = await supabase.from('mapel').select('id').eq('id', newId).maybeSingle();
		if (existingWithId) {
			newId = `${newId}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
		}

		const { data, error } = await supabase
			.from('mapel')
			.insert({
				id: newId,
				mapel: mapel.trim(),
			})
			.select();

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama mata pelajaran atau kode sudah ada' }, { status: 409 });
			}
			throw error;
		}

		return NextResponse.json({ success: true, data: data?.[0] });
	} catch (error) {
		console.error('Error POST Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function PUT(request) {
	const role = request.headers.get('x-user-role');
	if (role && role !== 'Admin' && role !== 'Kurikulum' && role !== 'Kepala Sekolah') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin & Kurikulum)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { id, mapel } = body;

		if (!id || !mapel || !mapel.trim()) {
			return NextResponse.json({ error: 'ID dan nama mata pelajaran wajib diisi' }, { status: 400 });
		}

		const supabase = supabaseAdmin || (await createClient());

		// 1. Dapatkan nama mapel lama terlebih dahulu untuk cascading
		const { data: existingMapel } = await supabase
			.from('mapel')
			.select('id, mapel')
			.eq('id', id)
			.maybeSingle();

		const oldMapelName = existingMapel?.mapel;
		const newMapelName = mapel.trim();

		// 2. Perbarui tabel mapel
		const { data, error } = await supabase
			.from('mapel')
			.update({ mapel: newMapelName })
			.eq('id', id)
			.select();

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama mata pelajaran sudah ada' }, { status: 409 });
			}
			throw error;
		}

		if (!data || data.length === 0) {
			return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan' }, { status: 404 });
		}

		// 3. Cascading otomatis ke tabel-tabel operasional jika nama mapel berubah
		if (oldMapelName && oldMapelName !== newMapelName) {
			await Promise.allSettled([
				supabase.from('guru_kbm').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('jadwal').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('absensi_mapel').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('jurnal').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('nilai_tugas').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
			]);
		}

		return NextResponse.json({ success: true, data: data[0] });
	} catch (error) {
		console.error('Error PUT Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function DELETE(request) {
	const role = request.headers.get('x-user-role');
	if (role && role !== 'Admin' && role !== 'Kurikulum' && role !== 'Kepala Sekolah') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin & Kurikulum)' }, { status: 403 });
	}
	try {
		const { id } = await request.json();
		if (!id) {
			return NextResponse.json({ error: 'ID mata pelajaran wajib diisi.' }, { status: 400 });
		}

		const supabase = supabaseAdmin || (await createClient());

		// 1. Ambil data mapel yang akan dihapus
		const { data: mapelItem, error: findErr } = await supabase
			.from('mapel')
			.select('id, mapel')
			.eq('id', id)
			.maybeSingle();

		if (findErr) throw findErr;
		if (!mapelItem) {
			return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan atau sudah dihapus.' }, { status: 404 });
		}

		// 2. Cek apakah mata pelajaran ini aktif digunakan di guru_kbm atau jadwal
		const [kbmRes, jadwalRes] = await Promise.all([
			supabase
				.from('guru_kbm')
				.select('id_kbm, kelas')
				.in('mapel', [mapelItem.mapel, mapelItem.id])
				.limit(10),
			supabase
				.from('jadwal')
				.select('id, kelas, hari')
				.in('mapel', [mapelItem.mapel, mapelItem.id])
				.limit(10),
		]);

		const kbmList = kbmRes.data || [];
		const jadwalList = jadwalRes.data || [];

		if (kbmList.length > 0 || jadwalList.length > 0) {
			const activeUsages = [];
			if (kbmList.length > 0) {
				const classes = [...new Set(kbmList.map((k) => k.kelas))].join(', ');
				activeUsages.push(`Penugasan Guru KBM (${classes})`);
			}
			if (jadwalList.length > 0) {
				const classes = [...new Set(jadwalList.map((j) => j.kelas))].join(', ');
				activeUsages.push(`Jadwal Pelajaran (${classes})`);
			}

			return NextResponse.json(
				{
					error: `Mata pelajaran "${mapelItem.mapel}" tidak dapat dihapus karena sedang aktif digunakan pada: ${activeUsages.join(' dan ')}. Harap sesuaikan penugasan atau jadwal KBM terlebih dahulu.`,
				},
				{ status: 400 }
			);
		}

		// 3. Bersihkan nilai KKTP terkait pada kurikulum_kktp jika ada
		await supabase.from('kurikulum_kktp').delete().eq('mapel_id', id);

		// 4. Hapus mata pelajaran dari tabel mapel
		const { data: delResult, error: delErr } = await supabase
			.from('mapel')
			.delete()
			.eq('id', id)
			.select();

		if (delErr) throw delErr;

		if (!delResult || delResult.length === 0) {
			return NextResponse.json({ error: 'Data mata pelajaran tidak ditemukan saat akan dihapus.' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			message: `Mata pelajaran "${mapelItem.mapel}" berhasil dihapus dari kurikulum.`,
		});
	} catch (error) {
		console.error('Error DELETE Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
