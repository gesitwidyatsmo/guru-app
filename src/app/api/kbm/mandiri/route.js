import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateKBMId() {
	return 'KBM-' + Date.now() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

// 1. GET: Ambil baris penugasan kelas+mapel secara eksplisit
export async function GET(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role !== 'Guru' || !userId) {
			return NextResponse.json({ error: 'Akses Ditolak: Hanya Guru yang dapat melihat Profil Ajarnya.' }, { status: 403 });
		}

		const supabase = await createClient();
		
		const { data: myRows, error } = await supabase
			.from('guru_kbm')
			.select('id_kbm, kelas, mapel')
			.eq('id_user', userId)
			.order('kelas', { ascending: true })
			.order('mapel', { ascending: true });

		if (error) throw error;

		return NextResponse.json(myRows || [], { status: 200 });
	} catch (error) {
		console.error('Error GET KBM Mandiri:', error);
		return NextResponse.json({ error: 'Terjadi kegagalan penarikan data.' }, { status: 500 });
	}
}

// 2. POST: Insert satu baris penugasan secara spesifik (Eksplisit)
export async function POST(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role !== 'Guru' || !userId) {
			return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
		}

		const body = await req.json();
		const { kelas, mapel } = body;

		if (!kelas || !mapel) {
			return NextResponse.json({ error: 'Kelas dan Mapel harus diisi lengkap.' }, { status: 400 });
		}

		const supabase = await createClient();
		
		// Cek apakah kombinasi kelas+mapel sudah ada
		const { data: existing } = await supabase
			.from('guru_kbm')
			.select('id_kbm')
			.eq('id_user', userId)
			.eq('kelas', kelas)
			.eq('mapel', mapel)
			.single();

		if (existing) {
			return NextResponse.json({ error: 'Anda sudah mendaftarkan mapel ini di kelas tersebut.' }, { status: 409 });
		}

		const rowToInsert = {
			id_kbm: generateKBMId(),
			id_user: userId,
			kelas: kelas,
			mapel: mapel,
		};

		const { error: insertError } = await supabase.from('guru_kbm').insert([rowToInsert]);
		
		if (insertError) throw insertError;

		return NextResponse.json({ success: true, message: 'Penugasan berhasil ditambahkan.' }, { status: 201 });
	} catch (error) {
		console.error('Error POST KBM Mandiri:', error);
		return NextResponse.json({ error: 'Kegagalan menyimpan penugasan.' }, { status: 500 });
	}
}

// 3. DELETE: Hapus spesifik satu baris penugasan
export async function DELETE(req) {
	try {
		const role = req.headers.get('x-user-role');
		const userId = req.headers.get('x-user-id');

		if (role !== 'Guru' || !userId) {
			return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
		}

		const { searchParams } = new URL(req.url);
		const id_kbm = searchParams.get('id_kbm');

		if (!id_kbm) {
			return NextResponse.json({ error: 'ID penugasan tak ditemukan.' }, { status: 400 });
		}

		const supabase = await createClient();
		
		// Memastikan hanya bisa menghapus miliknya sendiri
		const { error } = await supabase
			.from('guru_kbm')
			.delete()
			.match({ id_kbm: id_kbm, id_user: userId });
		
		if (error) throw error;

		return NextResponse.json({ success: true, message: 'Hak mengajar kelas ini berhasil dicabut.' }, { status: 200 });
	} catch (error) {
		console.error('Error DELETE KBM Mandiri:', error);
		return NextResponse.json({ error: 'Pencabutan penugasan gagal.' }, { status: 500 });
	}
}
