import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const generateRandomId = (index = 0) =>
	`${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 900 + 100)}${index % 10}`;

export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (!userId && !role) {
			return NextResponse.json({ error: 'Kredensial pengguna tidak valid.' }, { status: 401 });
		}

		const supabase = await createClient();
		const { searchParams } = new URL(req.url);
		const tahunAjar = searchParams.get('tahun_ajar');
		const semester = searchParams.get('semester');
		const targetUserId = searchParams.get('id_user');
		const filterKelas = searchParams.get('kelas');
		const isManager = role === 'Kurikulum' || role === 'Kepala Sekolah' || role === 'Admin';
		
		let jadwalQuery = supabase
			.from('jadwal')
			.select('*, users:id_user(nama_lengkap, username)')
			.order('jam_ke', { ascending: true });

		// Jika bukan manager (guru biasa), hanya lihat miliknya
		if (!isManager) {
			jadwalQuery = jadwalQuery.eq('id_user', userId);
		} else if (targetUserId) {
			jadwalQuery = jadwalQuery.eq('id_user', targetUserId);
		}

		if (filterKelas) jadwalQuery = jadwalQuery.eq('kelas', filterKelas);
		if (tahunAjar) jadwalQuery = jadwalQuery.eq('tahun_ajar', tahunAjar);
		if (semester) jadwalQuery = jadwalQuery.eq('semester', parseInt(semester));

		const { data: jadwalArray, error } = await jadwalQuery;

		if (error) throw error;

		return NextResponse.json(jadwalArray || []);
	} catch (error) {
		console.error('GET Jadwal Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}

export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json();
		const items = Array.isArray(body) ? body : [body];
		if (items.length === 0) {
			return NextResponse.json({ error: 'Data jadwal tidak boleh kosong.' }, { status: 400 });
		}

		const supabase = await createClient();
		const isManager = role === 'Kurikulum' || role === 'Admin';

		const rowsToInsert = items.map((item, idx) => {
			const targetUser = isManager && item.id_user ? item.id_user : userId;
			return {
				id: generateRandomId(idx),
				id_user: targetUser,
				mapel: item.mapel,
				kelas: item.kelas,
				hari: item.hari,
				jam_ke: item.jam_ke || '',
				jam_mulai: item.jam_mulai,
				jam_selesai: item.jam_selesai,
				tahun_ajar: item.tahun_ajar || '2026/2027',
				semester: item.semester ? parseInt(item.semester) : 1,
			};
		});

		const { error } = await supabase.from('jadwal').insert(rowsToInsert);
		
		if (error) throw error;

		return NextResponse.json({ success: true, count: rowsToInsert.length }, { status: 201 });
	} catch (error) {
		console.error('POST Jadwal Error:', error);
		return NextResponse.json({ error: error.message || 'Gagal merekam jadwal baru.' }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json();
		const supabase = await createClient();

		const updates = {
			mapel: body.mapel,
			kelas: body.kelas,
			hari: body.hari,
			jam_ke: body.jam_ke,
			jam_mulai: body.jam_mulai,
			jam_selesai: body.jam_selesai,
		};
		if (body.id_user && (role === 'Kurikulum' || role === 'Admin')) {
			updates.id_user = body.id_user;
		}

		let query = supabase.from('jadwal').update(updates).eq('id', body.id);
		// Jika bukan Kurikulum/Admin, batasi hanya edit jadwal sendiri
		if (role !== 'Kurikulum' && role !== 'Admin') {
			query = query.eq('id_user', userId);
		}

		const { data, error } = await query.select();

		if (error) throw error;
		
		if (!data || data.length === 0) {
			return NextResponse.json({ error: 'ID sesi tidak ditemukan dalam riwayat jadwal Anda' }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('PUT Jadwal Error:', error);
		return NextResponse.json({ error: 'Gagal menyunting jadwal.' }, { status: 500 });
	}
}

export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await req.json();
		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const supabase = await createClient();
		
		let query = supabase.from('jadwal').delete().eq('id', id);
		if (role !== 'Kurikulum' && role !== 'Admin') {
			query = query.eq('id_user', userId);
		}

		const { data, error } = await query.select();

		if (error) throw error;

		if (!data || data.length === 0) {
			return NextResponse.json({ error: 'ID sesi tidak tertaut dengan data Anda atau tidak ditemukan.' }, { status: 404 });
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('DELETE Jadwal Error:', error);
		return NextResponse.json({ error: 'Gagal mencabut jadwal.' }, { status: 500 });
	}
}
