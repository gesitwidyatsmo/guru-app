import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { extractTingkat, cleanTpDeskripsi } from '@/utils/erapor';

async function getAuthInfo(request) {
	let role = request.headers.get('x-user-role');
	let userId = request.headers.get('x-user-id');

	if (!role || !userId) {
		try {
			const client = await createClient();
			const {
				data: { user },
			} = await client.auth.getUser();
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
		} catch (e) {
			console.error('Error getting auth info:', e);
		}
	}
	return { role, userId };
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request);

		const { searchParams } = new URL(request.url);
		const mapelId = searchParams.get('mapel_id');
		const tingkat = searchParams.get('tingkat');

		let query = supabase
			.from('rapor_tp')
			.select('*, mapel:mapel_id(id, mapel, nama_resmi)')
			.order('tingkat', { ascending: true })
			.order('created_at', { ascending: true });

		// Jika role Guru: batasi HANYA TP yang diajarkan dan dibuat oleh guru tersebut
		if (role === 'Guru' && userId) {
			const [kbmRes, jdwRes] = await Promise.all([
				supabase.from('guru_kbm').select('kelas, mapel').eq('id_user', userId),
				supabase.from('jadwal').select('kelas, mapel').eq('id_user', userId),
			]);
			const myCombined = [...(kbmRes.data || []), ...(jdwRes.data || [])];

			const myMapelNames = [...new Set(myCombined.map((r) => r.mapel).filter(Boolean))];
			const myTingkats = [...new Set(myCombined.map((r) => extractTingkat(r.kelas)).filter(Boolean))];

			if (myMapelNames.length > 0 && myTingkats.length > 0) {
				const { data: allMapels } = await supabase
					.from('mapel')
					.select('id, mapel, nama_resmi');

				const allowedSet = new Set(myMapelNames);
				const myMapels = (allMapels || []).filter(
					(m) => allowedSet.has(m.mapel) || allowedSet.has(m.nama_resmi)
				);

				const myMapelIds = (myMapels || []).map((m) => m.id);
				if (myMapelIds.length > 0) {
					query = query.in('mapel_id', myMapelIds);
				} else {
					return NextResponse.json([]);
				}

				if (!tingkat || tingkat === 'all') {
					query = query.in('tingkat', myTingkats);
				}
			} else {
				return NextResponse.json([]);
			}

			// Filter ketat TP hanya milik guru yang bersangkutan
			query = query.eq('id_user', userId);
		}

		if (mapelId && mapelId !== 'all') {
			query = query.eq('mapel_id', mapelId);
		}

		if (tingkat && tingkat !== 'all') {
			query = query.eq('tingkat', parseInt(tingkat, 10));
		}

		let { data, error } = await query;

		// Fallback toleran jika kolom id_user belum dimigrasi di database
		if (error && error.message?.includes('id_user')) {
			let fallbackQuery = supabase
				.from('rapor_tp')
				.select('*, mapel:mapel_id(id, mapel, nama_resmi)')
				.order('tingkat', { ascending: true })
				.order('created_at', { ascending: true });

			if (role === 'Guru' && userId) {
				const { data: myKbm } = await supabase
					.from('guru_kbm')
					.select('kelas, mapel')
					.eq('id_user', userId);
				const myMapelNames = [...new Set((myKbm || []).map((r) => r.mapel).filter(Boolean))];
				const myTingkats = [...new Set((myKbm || []).map((r) => extractTingkat(r.kelas)).filter(Boolean))];
				if (myMapelNames.length > 0 && myTingkats.length > 0) {
					const { data: myMapels } = await supabase.from('mapel').select('id').in('mapel', myMapelNames);
					const myMapelIds = (myMapels || []).map((m) => m.id);
					if (myMapelIds.length > 0) fallbackQuery = fallbackQuery.in('mapel_id', myMapelIds);
					if (!tingkat || tingkat === 'all') fallbackQuery = fallbackQuery.in('tingkat', myTingkats);
				}
			}

			if (mapelId && mapelId !== 'all') fallbackQuery = fallbackQuery.eq('mapel_id', mapelId);
			if (tingkat && tingkat !== 'all') fallbackQuery = fallbackQuery.eq('tingkat', parseInt(tingkat, 10));

			const res = await fallbackQuery;
			data = res.data;
			error = res.error;
		}

		if (error) throw error;

		// Muat informasi profil pembuat (guru)
		if (Array.isArray(data) && data.length > 0) {
			const userIds = [...new Set(data.map((d) => d.id_user).filter(Boolean))];
			let userMap = {};
			if (userIds.length > 0) {
				const { data: usersData } = await supabase
					.from('users')
					.select('id_user, nama_lengkap, username')
					.in('id_user', userIds);
				userMap = Object.fromEntries((usersData || []).map((u) => [u.id_user, u]));
			}

			data = data.map((item) => ({
				...item,
				pembuat: item.id_user ? userMap[item.id_user] || null : null,
			}));
		}

		return NextResponse.json(data || []);
	} catch (error) {
		console.error('Error GET rapor_tp:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request);

		const body = await request.json();
		const { mapel_id, tingkat, deskripsi, kode_tp, list_tp } = body;

		if (!mapel_id) {
			return NextResponse.json({ error: 'Mata pelajaran wajib dipilih' }, { status: 400 });
		}

		// Validasi otorisasi jika Guru: harus mengajar mapel ini dan tingkat kelas ini
		if (role === 'Guru' && userId) {
			const [kbmRes, jdwRes] = await Promise.all([
				supabase.from('guru_kbm').select('kelas, mapel').eq('id_user', userId),
				supabase.from('jadwal').select('kelas, mapel').eq('id_user', userId),
			]);
			const myCombined = [...(kbmRes.data || []), ...(jdwRes.data || [])];

			const myMapelNames = [...new Set(myCombined.map((r) => r.mapel).filter(Boolean))];
			const myTingkats = [...new Set(myCombined.map((r) => extractTingkat(r.kelas)).filter(Boolean))];

			const { data: mapelData } = await supabase.from('mapel').select('id, mapel, nama_resmi').eq('id', mapel_id).maybeSingle();
			const hasMapel = mapelData && (myMapelNames.includes(mapelData.mapel) || myMapelNames.includes(mapelData.nama_resmi));
			if (!hasMapel) {
				return NextResponse.json({ error: `Akses Ditolak: Anda tidak mengajar mata pelajaran ${mapelData?.mapel || ''}.` }, { status: 403 });
			}

			const targetTingkat = parseInt(tingkat, 10);
			if (targetTingkat && !myTingkats.includes(targetTingkat)) {
				return NextResponse.json({ error: `Akses Ditolak: Anda tidak memiliki penugasan mengajar di Kelas ${targetTingkat}.` }, { status: 403 });
			}
		}

		// Support single or batch insert
		if (Array.isArray(list_tp) && list_tp.length > 0) {
			const rows = list_tp
				.map((t) => {
					const cleanD = cleanTpDeskripsi(t.deskripsi);
					const r = {
						mapel_id: mapel_id,
						tingkat: parseInt(tingkat, 10) || 7,
						deskripsi: cleanD.slice(0, 100),
						kode_tp: t.kode_tp?.trim() || '-',
					};
					if (userId) r.id_user = userId;
					return r;
				})
				.filter((r) => r.deskripsi);

			if (rows.length === 0) {
				return NextResponse.json({ error: 'Data TP tidak valid' }, { status: 400 });
			}

			let { data, error } = await supabase.from('rapor_tp').insert(rows).select();
			if (error && error.message?.includes('id_user')) {
				const fallbackRows = rows.map((r) => {
					const copy = { ...r };
					delete copy.id_user;
					return copy;
				});
				const res = await supabase.from('rapor_tp').insert(fallbackRows).select();
				data = res.data;
				error = res.error;
			}

			if (error) throw error;
			return NextResponse.json({ success: true, data });
		}

		const cleanDesc = cleanTpDeskripsi(deskripsi);
		if (!cleanDesc) {
			return NextResponse.json({ error: 'Deskripsi TP wajib diisi' }, { status: 400 });
		}

		if (cleanDesc.length > 100) {
			return NextResponse.json(
				{ error: 'Deskripsi Tujuan Pembelajaran maksimal 100 karakter agar rapi di lembar rapor' },
				{ status: 400 }
			);
		}

		let finalKodeTp = kode_tp?.trim();
		if (!finalKodeTp || finalKodeTp === '-') {
			const { count } = await supabase
				.from('rapor_tp')
				.select('*', { count: 'exact', head: true })
				.eq('mapel_id', mapel_id)
				.eq('tingkat', parseInt(tingkat, 10) || 7);
			finalKodeTp = `TP ${(count || 0) + 1}`;
		}

		const insertPayload = {
			mapel_id,
			tingkat: parseInt(tingkat, 10) || 7,
			deskripsi: cleanDesc,
			kode_tp: finalKodeTp,
		};
		if (userId) {
			insertPayload.id_user = userId;
		}

		let { data, error } = await supabase
			.from('rapor_tp')
			.insert(insertPayload)
			.select()
			.single();

		if (error && error.message?.includes('id_user')) {
			delete insertPayload.id_user;
			const res = await supabase.from('rapor_tp').insert(insertPayload).select().single();
			data = res.data;
			error = res.error;
		}

		if (error) throw error;
		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error('Error POST rapor_tp:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function PUT(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request);

		const body = await request.json();
		const { id, mapel_id, tingkat, deskripsi, kode_tp } = body;

		const cleanDesc = cleanTpDeskripsi(deskripsi);
		if (!id || !cleanDesc) {
			return NextResponse.json({ error: 'ID dan deskripsi wajib diisi' }, { status: 400 });
		}

		if (cleanDesc.length > 100) {
			return NextResponse.json(
				{ error: 'Deskripsi Tujuan Pembelajaran maksimal 100 karakter agar rapi di lembar rapor' },
				{ status: 400 }
			);
		}

		// Validasi kepemilikan TP untuk role Guru
		if (role === 'Guru' && userId) {
			const { data: existingTp } = await supabase
				.from('rapor_tp')
				.select('id, id_user')
				.eq('id', id)
				.maybeSingle();

			if (existingTp && existingTp.id_user && existingTp.id_user !== userId) {
				return NextResponse.json(
					{ error: 'Akses Ditolak: Anda hanya dapat mengubah TP yang Anda buat sendiri.' },
					{ status: 403 }
				);
			}
		}

		if (role === 'Guru' && userId && (mapel_id || tingkat)) {
			const [kbmRes, jdwRes] = await Promise.all([
				supabase.from('guru_kbm').select('kelas, mapel').eq('id_user', userId),
				supabase.from('jadwal').select('kelas, mapel').eq('id_user', userId),
			]);
			const myCombined = [...(kbmRes.data || []), ...(jdwRes.data || [])];

			const myMapelNames = [...new Set(myCombined.map((r) => r.mapel).filter(Boolean))];
			const myTingkats = [...new Set(myCombined.map((r) => extractTingkat(r.kelas)).filter(Boolean))];

			if (mapel_id) {
				const { data: mapelData } = await supabase.from('mapel').select('id, mapel, nama_resmi').eq('id', mapel_id).maybeSingle();
				const hasMapel = mapelData && (myMapelNames.includes(mapelData.mapel) || myMapelNames.includes(mapelData.nama_resmi));
				if (!hasMapel) {
					return NextResponse.json({ error: `Akses Ditolak: Anda tidak mengajar mata pelajaran ${mapelData?.mapel || ''}.` }, { status: 403 });
				}
			}

			if (tingkat) {
				const targetTingkat = parseInt(tingkat, 10);
				if (!myTingkats.includes(targetTingkat)) {
					return NextResponse.json({ error: `Akses Ditolak: Anda tidak memiliki penugasan mengajar di Kelas ${targetTingkat}.` }, { status: 403 });
				}
			}
		}

		const updatePayload = {
			deskripsi: cleanDesc,
			updated_at: new Date().toISOString(),
		};

		if (mapel_id) updatePayload.mapel_id = mapel_id;
		if (tingkat) updatePayload.tingkat = parseInt(tingkat, 10);
		if (kode_tp !== undefined) updatePayload.kode_tp = kode_tp.trim();

		const { data, error } = await supabase
			.from('rapor_tp')
			.update(updatePayload)
			.eq('id', id)
			.select()
			.single();

		if (error) throw error;
		return NextResponse.json({ success: true, data });
	} catch (error) {
		console.error('Error PUT rapor_tp:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function DELETE(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request);
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID wajib disertakan' }, { status: 400 });
		}

		// Validasi kepemilikan TP untuk role Guru
		if (role === 'Guru' && userId) {
			const { data: existingTp } = await supabase
				.from('rapor_tp')
				.select('id, id_user')
				.eq('id', id)
				.maybeSingle();

			if (existingTp && existingTp.id_user && existingTp.id_user !== userId) {
				return NextResponse.json(
					{ error: 'Akses Ditolak: Anda hanya dapat menghapus TP yang Anda buat sendiri.' },
					{ status: 403 }
				);
			}
		}

		const { error } = await supabase.from('rapor_tp').delete().eq('id', id);
		if (error) throw error;

		return NextResponse.json({ success: true, message: 'TP berhasil dihapus' });
	} catch (error) {
		console.error('Error DELETE rapor_tp:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
