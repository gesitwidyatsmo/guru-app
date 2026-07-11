import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const generateRandomId = () => Math.floor(Math.random() * 100000).toString();

export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role === 'Admin') {
			return NextResponse.json({ error: 'Admin tidak mengelola maupun mengatur jadwal personal Guru.' }, { status: 403 });
		}

		if (!userId) {
			return NextResponse.json({ error: 'Kredensial pengguna tidak valid.' }, { status: 401 });
		}

		const supabase = await createClient();
		
		const { data: jadwalArray, error } = await supabase
			.from('jadwal')
			.select('*')
			.eq('id_user', userId)
			.order('jam_ke', { ascending: true });

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

		if (role === 'Admin') return NextResponse.json({ error: 'Terlarang bagi Admin.' }, { status: 403 });
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json();
		const supabase = await createClient();

		const newJadwalItem = {
			id: generateRandomId(),
			id_user: userId,
			mapel: body.mapel,
			kelas: body.kelas,
			hari: body.hari,
			jam_ke: body.jam_ke || '',
			jam_mulai: body.jam_mulai,
			jam_selesai: body.jam_selesai,
		};

		const { error } = await supabase.from('jadwal').insert(newJadwalItem);
		
		if (error) throw error;

		return NextResponse.json({ success: true, id: newJadwalItem.id }, { status: 201 });
	} catch (error) {
		console.error('POST Jadwal Error:', error);
		return NextResponse.json({ error: 'Gagal merekam jadwal baru.' }, { status: 500 });
	}
}

export async function PUT(req) {
	try {
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

		const { data, error } = await supabase
			.from('jadwal')
			.update(updates)
			.eq('id', body.id)
			.eq('id_user', userId)
			.select();

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
		const userId = req.headers.get('x-user-id');
		if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id } = await req.json();
		if (!id) return NextResponse.json({ error: 'ID diperlukan' }, { status: 400 });

		const supabase = await createClient();
		
		const { data, error } = await supabase
			.from('jadwal')
			.delete()
			.eq('id', id)
			.eq('id_user', userId)
			.select();

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
