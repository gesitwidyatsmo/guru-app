import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const getAuthData = (request) => {
	const role = request.headers.get('x-user-role');
	const id = request.headers.get('x-user-id');
	const name = request.headers.get('x-user-name');
	if (!role || !id) return null;
	return { role, id, name: decodeURIComponent(name || '') };
};

export async function GET(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		const supabase = await createClient();

		if (id) {
			const { data: task, error } = await supabase.from('tugas_online').select('*').eq('id', id).single();
			
			if (error || !task) return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });
			
			const parsedSoal = typeof task.soal === 'string' ? JSON.parse(task.soal) : task.soal;

			return NextResponse.json({
				id: task.id,
				pin: task.pin,
				judul: task.judul,
				mapel: task.mapel,
				materi: task.materi,
				tipe_soal: task.tipe_soal,
				soal: typeof task.soal === 'string' ? task.soal : JSON.stringify(task.soal),
				kategori: parsedSoal?.kategori || 'Formatif',
				type: parsedSoal?.type || 'Tugas Online',
				createdAt: task.created_at,
				createdBy: task.created_by,
			});
		}

		// List all tasks (For Guru, maybe we want to list all or only theirs? The original listed all rows in Data_Tugas)
		const { data: tasks, error } = await supabase.from('tugas_online').select('*').order('created_at', { ascending: false });
		if (error) throw error;

		const formattedTasks = (tasks || []).map(task => {
			const parsedSoal = typeof task.soal === 'string' ? JSON.parse(task.soal) : task.soal;
			return {
				id: task.id,
				pin: task.pin,
				judul: task.judul,
				mapel: task.mapel,
				materi: task.materi,
				tipe_soal: task.tipe_soal,
				soal: typeof task.soal === 'string' ? task.soal : JSON.stringify(task.soal),
				kategori: parsedSoal?.kategori || 'Formatif',
				type: parsedSoal?.type || 'Tugas Online',
				createdAt: task.created_at,
				createdBy: task.created_by,
			};
		});

		return NextResponse.json(formattedTasks);
	} catch (error) {
		console.error('API Error:', error);
		return NextResponse.json({ error: 'Gagal mengambil data tugas' }, { status: 500 });
	}
}

export async function POST(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const { judul, mapel, materi, tipe_soal, kategori, type, soal } = body;

		if (!judul || !tipe_soal || !soal) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const pin = Math.random().toString(36).substring(2, 8).toUpperCase();
		const newId = Date.now().toString();

		const supabase = await createClient();

		const finalSoal = typeof soal === 'object' && soal !== null ? { ...soal, kategori: kategori || 'Formatif', type: type || 'Tugas Online' } : soal;

		const { error } = await supabase.from('tugas_online').insert({
			id: newId,
			pin: pin,
			judul: judul,
			mapel: mapel || '',
			materi: materi || '',
			tipe_soal: tipe_soal,
			soal: finalSoal,
			created_by: auth.name || auth.id,
		});

		if (error) throw error;

		return NextResponse.json({ message: 'Tugas berhasil dibuat', pin }, { status: 201 });
	} catch (error) {
		console.error('API Error POST:', error);
		return NextResponse.json({ error: 'Gagal membuat tugas' }, { status: 500 });
	}
}

export async function DELETE(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const { searchParams } = new URL(request.url);
		const id = searchParams.get('id');

		if (!id) return NextResponse.json({ error: 'ID tidak ditemukan' }, { status: 400 });

		const supabase = await createClient();

		// Optional: auth check if they can delete (The original didn't check ownership for delete, just id existence)
		const { data: rowToDelete, error: fetchError } = await supabase.from('tugas_online').select('id').eq('id', id).single();
		if (fetchError || !rowToDelete) return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });

		const { error: deleteError } = await supabase.from('tugas_online').delete().eq('id', id);
		if (deleteError) throw deleteError;

		return NextResponse.json({ message: 'Tugas berhasil dihapus' }, { status: 200 });
	} catch (error) {
		console.error('API Error DELETE:', error);
		return NextResponse.json({ error: 'Gagal menghapus tugas' }, { status: 500 });
	}
}

export async function PUT(request) {
	const auth = getAuthData(request);
	if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const { id, judul, mapel, materi, tipe_soal, kategori, type, soal } = body;

		if (!id || !judul || !tipe_soal || !soal) {
			return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
		}

		const supabase = await createClient();

		const { data: rowToUpdate, error: fetchError } = await supabase.from('tugas_online').select('id').eq('id', id).single();
		if (fetchError || !rowToUpdate) return NextResponse.json({ error: 'Tugas tidak ditemukan' }, { status: 404 });

		const finalSoal = typeof soal === 'object' && soal !== null ? { ...soal, kategori: kategori || 'Formatif', type: type || 'Tugas Online' } : soal;

		const updates = {
			judul: judul,
			mapel: mapel || '',
			materi: materi || '',
			tipe_soal: tipe_soal,
			soal: finalSoal,
		};

		const { error: updateError } = await supabase.from('tugas_online').update(updates).eq('id', id);
		if (updateError) throw updateError;

		return NextResponse.json({ message: 'Tugas berhasil diperbarui' }, { status: 200 });
	} catch (error) {
		console.error('API Error PUT:', error);
		return NextResponse.json({ error: 'Gagal memperbarui tugas' }, { status: 500 });
	}
}
