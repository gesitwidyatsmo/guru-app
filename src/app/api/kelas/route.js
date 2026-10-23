import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

const generateId = () => Math.random().toString(36).substr(2, 9);

// 1. GET: Ambil semua data kelas
export async function GET(request) {
	try {
		const cookieStore = await cookies();
		const supabase = await createClient();

		let role = request.headers.get('x-user-role') || cookieStore.get('user_role')?.value;
		let userId = request.headers.get('x-user-id') || cookieStore.get('user_id')?.value;
		const { searchParams } = new URL(request.url);
		const showAll = searchParams.get('all') === 'true';
		const onlyKbm = searchParams.get('only_kbm') === 'true';
		const onlyWali = searchParams.get('only_wali') === 'true';
		const mapelParam = searchParams.get('mapel');

		if (!role || !userId) {
			const {
				data: { user },
			} = await supabase.auth.getUser();
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

		if (!userId) {
			const rawName = request.headers.get('x-user-name') || cookieStore.get('user_name')?.value;
			if (rawName) {
				const userName = decodeURIComponent(rawName);
				const { data: u } = await supabaseAdmin
					.from('users')
					.select('id_user, role')
					.eq('nama_lengkap', userName)
					.maybeSingle();
				if (u) {
					userId = u.id_user;
					role = role || u.role;
				}
			}
		}

		let allowedClasses = null;

		if (showAll || role === 'Admin' || role === 'Kepala Sekolah' || role === 'Kesiswaan' || role === 'Kurikulum') {
			allowedClasses = null; // Ambil semua
		} else if (role === 'Guru' && userId) {
			if (onlyWali) {
				// Khusus menu Wali Kelas ERapor (Presensi, Ekskul, Leger, Cetak):
				// HANYA kelas binaan tempat guru bertindak sebagai WALI KELAS
				const [{ data: kelasWali }, { data: relasiWali }, { data: userRow }] = await Promise.all([
					supabaseAdmin.from('kelas').select('nama_kelas').eq('id_wali_kelas', userId),
					supabaseAdmin.from('wali_kelas').select('id_kelas, kelas:id_kelas(nama_kelas)').eq('user_id', userId).eq('is_active', true),
					supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle(),
				]);

				const directWali = (kelasWali || []).map((r) => r.nama_kelas).filter(Boolean);
				const relWali = (relasiWali || []).map((r) => r.kelas?.nama_kelas).filter(Boolean);
				let textWali = [];
				if (userRow?.nama_lengkap) {
					const { data: byName } = await supabaseAdmin.from('kelas').select('nama_kelas').ilike('wali_kelas', `%${userRow.nama_lengkap}%`);
					textWali = (byName || []).map((r) => r.nama_kelas).filter(Boolean);
				}
				allowedClasses = [...new Set([...directWali, ...relWali, ...textWali])];
			} else if (onlyKbm) {
				// Khusus KBM/ERapor: Hanya kelas tempat guru mengajar secara riil (gabungan guru_kbm & jadwal)
				let kbmQuery = supabaseAdmin.from('guru_kbm').select('kelas, mapel').eq('id_user', userId);
				let jdwQuery = supabaseAdmin.from('jadwal').select('kelas, mapel').eq('id_user', userId);

				if (mapelParam) {
					kbmQuery = kbmQuery.eq('mapel', mapelParam);
					jdwQuery = jdwQuery.eq('mapel', mapelParam);
				}

				const [kbmRes, jdwRes] = await Promise.all([kbmQuery, jdwQuery]);
				const combined = [...(kbmRes.data || []), ...(jdwRes.data || [])];
				allowedClasses = [...new Set(combined.map((r) => r.kelas).filter(Boolean))];
			} else {
				let kbmQuery = supabaseAdmin.from('guru_kbm').select('kelas').eq('id_user', userId);
				let jdwQuery = supabaseAdmin.from('jadwal').select('kelas').eq('id_user', userId);
				if (mapelParam) {
					kbmQuery = kbmQuery.eq('mapel', mapelParam);
					jdwQuery = jdwQuery.eq('mapel', mapelParam);
				}

				const [kbmRes, jdwRes, waliRes] = await Promise.all([
					kbmQuery,
					jdwQuery,
					supabaseAdmin.from('kelas').select('nama_kelas').eq('id_wali_kelas', userId),
				]);

				const kbmClasses = [...(kbmRes.data || []), ...(jdwRes.data || [])].map((r) => r.kelas).filter(Boolean);
				const waliClasses = (waliRes.data || []).map((r) => r.nama_kelas).filter(Boolean);
				allowedClasses = [...new Set([...kbmClasses, ...waliClasses])];
			}
		} else {
			allowedClasses = []; // Guest / unauthorized
		}

		// Gunakan supabaseAdmin agar RLS tidak memblokir pembacaan kelas yang sudah divalidasi otorisasi di atas
		const db = supabaseAdmin || (await createClient());

		let query = db
			.from('kelas')
			.select(`
				id,
				nama_kelas,
				id_wali_kelas,
				users!kelas_id_wali_kelas_fkey(nama_lengkap)
			`)
			.order('nama_kelas', { ascending: true });

		if (allowedClasses !== null) {
			if (allowedClasses.length === 0) {
				return NextResponse.json([]); // No classes allowed
			}
			query = query.in('nama_kelas', allowedClasses);
		}

		const { data, error } = await query;
		if (error) {
			console.error('Error fetching classes:', error);
			return NextResponse.json({ error: error.message }, { status: 500 });
		}

		const formattedData = (data || []).map((item) => ({
			id: item.id,
			kelas: item.nama_kelas,
			nama_kelas: item.nama_kelas,
			id_wali_kelas: item.id_wali_kelas,
			wali_kelas: item.users ? item.users.nama_lengkap : 'Belum ditentukan',
		}));

		return NextResponse.json(formattedData);
	} catch (error) {
		console.error('Error in GET /api/kelas:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

// 2. POST: Tambah kelas baru
export async function POST(request) {
	try {
		const supabase = await createClient();
		const body = await request.json();
		const { nama_kelas, id_wali_kelas } = body;

		if (!nama_kelas) {
			return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 });
		}

		const newKelas = {
			id: `KLS-${generateId().toUpperCase()}`,
			nama_kelas,
			id_wali_kelas: id_wali_kelas || null,
			created_at: new Date().toISOString(),
		};

		const { data, error } = await supabase.from('kelas').insert([newKelas]).select();
		if (error) throw error;

		return NextResponse.json(data[0], { status: 201 });
	} catch (error) {
		console.error('Error in POST /api/kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// 3. PUT: Update data kelas
export async function PUT(request) {
	try {
		const supabase = await createClient();
		const body = await request.json();
		const { id, nama_kelas, id_wali_kelas } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID Kelas wajib diisi' }, { status: 400 });
		}

		const updateData = {};
		if (nama_kelas !== undefined) updateData.nama_kelas = nama_kelas;
		if (id_wali_kelas !== undefined) updateData.id_wali_kelas = id_wali_kelas;

		const { data, error } = await supabase
			.from('kelas')
			.update(updateData)
			.eq('id', id)
			.select();

		if (error) throw error;
		return NextResponse.json(data[0]);
	} catch (error) {
		console.error('Error in PUT /api/kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// 4. DELETE: Hapus kelas
export async function DELETE(request) {
	try {
		const supabase = await createClient();
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID Kelas wajib disertakan' }, { status: 400 });
		}

		const { error } = await supabase.from('kelas').delete().eq('id', id);
		if (error) throw error;

		return NextResponse.json({ message: 'Kelas berhasil dihapus' });
	} catch (error) {
		console.error('Error in DELETE /api/kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
