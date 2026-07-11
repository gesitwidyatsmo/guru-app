import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const generateId = () => Math.random().toString(36).substr(2, 9);

// 1. GET: Ambil semua data kelas
export async function GET(request) {
	try {
		const supabase = await createClient();
		const role = request.headers.get('x-user-role');
		const userId = request.headers.get('x-user-id');
		const { searchParams } = new URL(request.url);
		const showAll = searchParams.get('all') === 'true';

		let allowedClasses = null;

		if (showAll || role === 'Admin') {
			allowedClasses = null; // Ambil semua
		} else if (role === 'Guru' && userId) {
			const { data: kbmData } = await supabase
				.from('guru_kbm')
				.select('kelas')
				.eq('id_user', userId);
			
			if (kbmData) {
				allowedClasses = [...new Set(kbmData.map(r => r.kelas))];
			} else {
				allowedClasses = [];
			}
		} else {
			allowedClasses = []; // Guest / unauthorized
		}

		let query = supabase.from('kelas').select(`
			id,
			nama_kelas,
			id_wali_kelas,
			users!kelas_id_wali_kelas_fkey(nama_lengkap)
		`).order('nama_kelas', { ascending: true });

		if (allowedClasses !== null) {
			if (allowedClasses.length === 0) {
				return NextResponse.json([]); // No classes allowed
			}
			query = query.in('nama_kelas', allowedClasses);
		}

		const { data: kelasData, error } = await query;

		if (error) throw error;

		const formattedData = kelasData.map(k => ({
			id: k.id,
			kelas: k.nama_kelas,
			id_wali_kelas: k.id_wali_kelas || '',
			wali_kelas: k.users?.nama_lengkap || '',
		}));

		return NextResponse.json(formattedData);
	} catch (error) {
		console.error('Error GET Kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// 2. POST: Tambah kelas baru
export async function POST(request) {
	if (request.headers.get('x-user-role') !== 'Admin') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { kelas, id_wali_kelas } = body;

		if (!kelas) {
			return NextResponse.json({ error: 'Nama kelas wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { error } = await supabase.from('kelas').insert({
			id: generateId(),
			nama_kelas: kelas,
			id_wali_kelas: id_wali_kelas || null,
		});

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama kelas sudah ada' }, { status: 409 });
			}
			throw error;
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error POST Kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// 3. PUT: Edit/Update data kelas
export async function PUT(request) {
	if (request.headers.get('x-user-role') !== 'Admin') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { id, kelas, id_wali_kelas } = body;

		if (!id || !kelas) {
			return NextResponse.json({ error: 'ID dan nama kelas wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { error } = await supabase.from('kelas').update({
			nama_kelas: kelas,
			id_wali_kelas: id_wali_kelas || null,
		}).eq('id', id);

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama kelas sudah ada' }, { status: 409 });
			}
			throw error;
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error PUT Kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

// 4. DELETE: Hapus kelas
export async function DELETE(request) {
	if (request.headers.get('x-user-role') !== 'Admin') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) {
			return NextResponse.json({ error: 'ID wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { error } = await supabase.from('kelas').delete().eq('id', id);

		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error DELETE Kelas:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
