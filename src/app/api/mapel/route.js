import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { normalizeTingkatArray } from '@/lib/eraporEkskulUtils';

const generateId = (name = '') => {
	const clean = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
	const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
	return clean ? `MP-${clean}` : `MP-${randomSuffix}`;
};

async function saveTingkatToAppSettings(supabase, mapelId, tingkatArray) {
	try {
		const { data } = await supabase.from('app_settings').select('value').eq('key', 'mapel_tingkat_settings').maybeSingle();
		const current = (data?.value && typeof data.value === 'object') ? data.value : {};
		current[mapelId] = tingkatArray;
		await supabase.from('app_settings').upsert({
			key: 'mapel_tingkat_settings',
			value: current,
			updated_at: new Date().toISOString(),
		}, { onConflict: 'key' });
	} catch (err) {
		console.warn('Failed to save mapel_tingkat_settings to app_settings:', err);
	}
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		let role = request.headers.get('x-user-role');
		let userId = request.headers.get('x-user-id');
		const { searchParams } = new URL(request.url);
		const showAll = searchParams.get('all') === 'true';
		const onlyKbm = searchParams.get('only_kbm') === 'true';
		const kelasParam = searchParams.get('kelas');

		if (!role || !userId) {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) {
				const { data: userProfile } = await supabaseAdmin
					.from('users')
					.select('id_user, role')
					.eq('auth_id', user.id)
					.maybeSingle();
				if (userProfile) {
					role = role || userProfile.role;
					userId = userId || userProfile.id_user;
				}
			}
		}

		let allowedMapels = null;

		const isPrivileged = showAll || role === 'Admin' || role === 'Kepala Sekolah' || role === 'Kurikulum';

		let mapelKelasMap = {};

		if (kelasParam) {
			if (isPrivileged) {
				const [kbmRes, jadRes] = await Promise.all([
					supabase.from('guru_kbm').select('mapel').eq('kelas', kelasParam),
					supabase.from('jadwal').select('mapel').eq('kelas', kelasParam),
				]);
				const combined = [...(kbmRes.data || []), ...(jadRes.data || [])];
				if (combined.length > 0) {
					allowedMapels = [...new Set(combined.map((r) => r.mapel).filter(Boolean))];
				} else {
					allowedMapels = null; // fallback jika belum ada data KBM spesifik
				}
			} else if (role === 'Guru' && userId) {
				// Jika only_kbm=true, abaikan hak wali kelas agar murni mapel ajar guru itu sendiri
				let waliClass = null;
				if (!onlyKbm) {
					const { data } = await supabase
						.from('kelas')
						.select('id')
						.eq('nama_kelas', kelasParam)
						.eq('id_wali_kelas', userId)
						.maybeSingle();
					waliClass = data;
				}

				if (waliClass) {
					// Wali Kelas dapat melihat semua mapel di kelas binaannya
					const [kbmRes, jadRes] = await Promise.all([
						supabase.from('guru_kbm').select('mapel').eq('kelas', kelasParam),
						supabase.from('jadwal').select('mapel').eq('kelas', kelasParam),
					]);
					const combined = [...(kbmRes.data || []), ...(jadRes.data || [])];
					allowedMapels = [...new Set(combined.map((r) => r.mapel).filter(Boolean))];
				} else {
					// Guru mapel hanya dapat melihat mapel yang diajarkannya di kelas ini
					const [kbmRes, jadRes] = await Promise.all([
						supabase.from('guru_kbm').select('mapel').eq('kelas', kelasParam).eq('id_user', userId),
						supabase.from('jadwal').select('mapel').eq('kelas', kelasParam).eq('id_user', userId),
					]);
					const combined = [...(kbmRes.data || []), ...(jadRes.data || [])];
					allowedMapels = [...new Set(combined.map((r) => r.mapel).filter(Boolean))];
				}
			} else {
				allowedMapels = [];
			}
		} else {
			if (isPrivileged) {
				allowedMapels = null; // Semua mapel
			} else if (role === 'Guru' && userId) {
				const [kbmRes, jadRes] = await Promise.all([
					supabase.from('guru_kbm').select('mapel, kelas').eq('id_user', userId),
					supabase.from('jadwal').select('mapel, kelas').eq('id_user', userId),
				]);
				const combined = [...(kbmRes.data || []), ...(jadRes.data || [])];
				allowedMapels = [...new Set(combined.map((r) => r.mapel).filter(Boolean))];

				combined.forEach((row) => {
					if (!row.mapel || !row.kelas) return;
					if (!mapelKelasMap[row.mapel]) mapelKelasMap[row.mapel] = new Set();
					mapelKelasMap[row.mapel].add(row.kelas);
				});
			} else {
				allowedMapels = [];
			}
		}

		// Ambil data mapel (termasuk urutan dan tingkat)
		let allMapelRows = null;
		let appSettingsTingkatMap = {};

		const { data: qData, error: qErr } = await supabase
			.from('mapel')
			.select('id, mapel, nama_resmi, kelompok, urutan, tingkat')
			.order('urutan', { ascending: true })
			.order('mapel', { ascending: true });

		if (qErr && (qErr.code === '42703' || qErr.message?.includes('tingkat'))) {
			// Kolom 'tingkat' belum dimigrasi di DB, baca fallback dari app_settings
			const [fallbackRes, setRes] = await Promise.all([
				supabase
					.from('mapel')
					.select('id, mapel, nama_resmi, kelompok, urutan')
					.order('urutan', { ascending: true })
					.order('mapel', { ascending: true }),
				supabase
					.from('app_settings')
					.select('value')
					.eq('key', 'mapel_tingkat_settings')
					.maybeSingle(),
			]);
			allMapelRows = fallbackRes.data || [];
			if (setRes.data?.value && typeof setRes.data.value === 'object') {
				appSettingsTingkatMap = setRes.data.value;
			}
		} else if (qErr) {
			throw qErr;
		} else {
			allMapelRows = qData || [];
		}

		// Normalisasi tingkat dan urutan untuk setiap baris mapel
		allMapelRows = (allMapelRows || []).map((m, idx) => {
			const rawTingkat = m.tingkat || appSettingsTingkatMap[m.id] || appSettingsTingkatMap[m.mapel];
			return {
				...m,
				urutan: m.urutan != null && !isNaN(Number(m.urutan)) ? Number(m.urutan) : idx + 1,
				tingkat: normalizeTingkatArray(rawTingkat, m.id || m.mapel),
			};
		});

		let result = [];
		if (allowedMapels === null) {
			result = allMapelRows || [];
		} else if (allowedMapels.length === 0) {
			return NextResponse.json([]);
		} else {
			const allowedSet = new Set(allowedMapels);
			result = (allMapelRows || []).filter(
				(m) => allowedSet.has(m.mapel) || allowedSet.has(m.nama_resmi)
			);

			// Fallback: jika ada mapel dari KBM/jadwal yang belum ada di tabel mapel
			const existingNames = new Set(result.map((r) => r.mapel));
			for (const m of allowedMapels) {
				if (!existingNames.has(m)) {
					result.push({
						id: `MP-${m.replace(/[^A-Za-z0-9]/g, '').slice(0, 8)}`,
						mapel: m,
						nama_resmi: m,
						kelompok: 'A',
					});
				}
			}
		}

		// Lampirkan kelas_list untuk mempermudah sinkronisasi instan di frontend
		if (Object.keys(mapelKelasMap).length > 0) {
			result = result.map((m) => {
				const directK = mapelKelasMap[m.mapel] ? [...mapelKelasMap[m.mapel]] : [];
				const resmiK = m.nama_resmi && mapelKelasMap[m.nama_resmi] ? [...mapelKelasMap[m.nama_resmi]] : [];
				return {
					...m,
					kelas_list: [...new Set([...directK, ...resmiK])],
				};
			});
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
		const { id, mapel, nama_resmi, kelompok, urutan, tingkat } = body;

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

		// Tentukan urutan otomatis jika tidak disertakan
		let targetUrutan = urutan;
		if (targetUrutan == null || isNaN(parseInt(targetUrutan, 10))) {
			const { data: maxRow } = await supabase.from('mapel').select('urutan').order('urutan', { ascending: false }).limit(1);
			targetUrutan = ((maxRow?.[0]?.urutan) || 0) + 1;
		} else {
			targetUrutan = parseInt(targetUrutan, 10);
		}

		const normTingkat = normalizeTingkatArray(tingkat, newId || mapel.trim());

		const insertPayload = {
			id: newId,
			mapel: mapel.trim(),
			nama_resmi: (nama_resmi && nama_resmi.trim()) || mapel.trim(),
			kelompok: kelompok || 'A',
			urutan: targetUrutan,
		};

		let { data, error } = await supabase
			.from('mapel')
			.insert({ ...insertPayload, tingkat: normTingkat })
			.select();

		if (error && (error.code === '42703' || error.message?.includes('tingkat'))) {
			const resFallback = await supabase.from('mapel').insert(insertPayload).select();
			data = resFallback.data;
			error = resFallback.error;
			if (!error) {
				await saveTingkatToAppSettings(supabase, newId, normTingkat);
			}
		}

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama mata pelajaran atau kode sudah ada' }, { status: 409 });
			}
			throw error;
		}

		const createdItem = { ...(data?.[0] || insertPayload), tingkat: normTingkat };
		return NextResponse.json({ success: true, data: createdItem });
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
		const supabase = supabaseAdmin || (await createClient());

		// 1. Dukungan Batch Reorder Urutan Mapel
		if (body.reorder && Array.isArray(body.items)) {
			const updates = body.items.map((item, idx) => {
				const uVal = item.urutan != null && !isNaN(parseInt(item.urutan, 10))
					? parseInt(item.urutan, 10)
					: idx + 1;
				return supabase.from('mapel').update({ urutan: uVal }).eq('id', item.id);
			});
			await Promise.all(updates);
			return NextResponse.json({ success: true, message: 'Urutan mata pelajaran berhasil diperbarui' });
		}

		const { id, mapel, nama_resmi, kelompok, urutan, tingkat } = body;

		if (!id || !mapel || !mapel.trim()) {
			return NextResponse.json({ error: 'ID dan nama mata pelajaran wajib diisi' }, { status: 400 });
		}

		// 2. Dapatkan nama mapel lama terlebih dahulu untuk cascading
		const { data: existingMapel } = await supabase
			.from('mapel')
			.select('id, mapel')
			.eq('id', id)
			.maybeSingle();

		const oldMapelName = existingMapel?.mapel;
		const newMapelName = mapel.trim();

		// 3. Perbarui tabel mapel
		const updateData = { mapel: newMapelName };
		if (nama_resmi !== undefined) updateData.nama_resmi = (nama_resmi || '').trim() || newMapelName;
		if (kelompok !== undefined) updateData.kelompok = kelompok;
		if (urutan !== undefined && !isNaN(parseInt(urutan, 10))) updateData.urutan = parseInt(urutan, 10);

		let normTingkat = undefined;
		if (tingkat !== undefined) {
			normTingkat = normalizeTingkatArray(tingkat, id || newMapelName);
			updateData.tingkat = normTingkat;
		}

		let { data, error } = await supabase
			.from('mapel')
			.update(updateData)
			.eq('id', id)
			.select();

		if (error && (error.code === '42703' || error.message?.includes('tingkat'))) {
			delete updateData.tingkat;
			const resFallback = await supabase.from('mapel').update(updateData).eq('id', id).select();
			data = resFallback.data;
			error = resFallback.error;
			if (!error && normTingkat) {
				await saveTingkatToAppSettings(supabase, id, normTingkat);
			}
		}

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama mata pelajaran sudah ada' }, { status: 409 });
			}
			throw error;
		}

		if (!data || data.length === 0) {
			return NextResponse.json({ error: 'Mata pelajaran tidak ditemukan' }, { status: 404 });
		}

		// 4. Cascading otomatis ke tabel-tabel operasional jika nama mapel berubah
		if (oldMapelName && oldMapelName !== newMapelName) {
			await Promise.allSettled([
				supabase.from('guru_kbm').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('jadwal').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('absensi_mapel').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('jurnal').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
				supabase.from('nilai_tugas').update({ mapel: newMapelName }).eq('mapel', oldMapelName),
			]);
		}

		const updatedItem = { ...(data[0] || {}), tingkat: normTingkat || data[0]?.tingkat };
		return NextResponse.json({ success: true, data: updatedItem });
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
