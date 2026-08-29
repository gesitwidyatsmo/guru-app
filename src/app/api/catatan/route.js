import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function generateId() {
	return 'note_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
}

// GET CATATAN
export async function GET(req) {
	try {
		const userId = req.headers.get('x-user-id');
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const supabase = await createClient();
		const { data, error } = await supabase
			.from('catatan')
			.select('*')
			.eq('user_id', userId)
			.order('pinned', { ascending: false })
			.order('updated_at', { ascending: false });

		if (error) throw error;

		return NextResponse.json(data || [], { status: 200 });
	} catch (error) {
		console.error('GET /api/catatan Error:', error);
		return NextResponse.json({ error: 'Gagal mengambil catatan' }, { status: 500 });
	}
}

// POST CATATAN BARU
export async function POST(req) {
	try {
		const userId = req.headers.get('x-user-id');
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { id, judul, isi, warna, pinned, foto_url } = body;

		const supabase = await createClient();
		const finalId = id || generateId();

		const { data, error } = await supabase
			.from('catatan')
			.insert({
				id: finalId,
				user_id: userId,
				judul: judul || '',
				isi: isi || '',
				warna: warna || 'cream',
				pinned: !!pinned,
				foto_url: foto_url || null,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (error) throw error;

		return NextResponse.json({ message: 'Catatan berhasil dibuat', data }, { status: 201 });
	} catch (error) {
		console.error('POST /api/catatan Error:', error);
		return NextResponse.json({ error: 'Gagal membuat catatan' }, { status: 500 });
	}
}

// PUT / UPDATE CATATAN
export async function PUT(req) {
	try {
		const userId = req.headers.get('x-user-id');
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { id, judul, isi, warna, pinned, foto_url } = body;

		if (!id) {
			return NextResponse.json({ error: 'ID catatan wajib' }, { status: 400 });
		}

		const supabase = await createClient();
		const updatePayload = {
			updated_at: new Date().toISOString(),
		};

		if (judul !== undefined) updatePayload.judul = judul;
		if (isi !== undefined) updatePayload.isi = isi;
		if (warna !== undefined) updatePayload.warna = warna;
		if (pinned !== undefined) updatePayload.pinned = pinned;
		if (foto_url !== undefined) updatePayload.foto_url = foto_url;

		const { data, error } = await supabase
			.from('catatan')
			.update(updatePayload)
			.eq('id', id)
			.eq('user_id', userId)
			.select()
			.single();

		if (error) throw error;

		return NextResponse.json({ message: 'Catatan berhasil diperbarui', data }, { status: 200 });
	} catch (error) {
		console.error('PUT /api/catatan Error:', error);
		return NextResponse.json({ error: 'Gagal memperbarui catatan' }, { status: 500 });
	}
}

// DELETE CATATAN
export async function DELETE(req) {
	try {
		const userId = req.headers.get('x-user-id');
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { searchParams } = new URL(req.url);
		let id = searchParams.get('id');

		if (!id) {
			const body = await req.json().catch(() => ({}));
			id = body.id;
		}

		if (!id) {
			return NextResponse.json({ error: 'ID catatan wajib' }, { status: 400 });
		}

		const supabase = await createClient();
		const { error } = await supabase
			.from('catatan')
			.delete()
			.eq('id', id)
			.eq('user_id', userId);

		if (error) throw error;

		return NextResponse.json({ message: 'Catatan berhasil dihapus' }, { status: 200 });
	} catch (error) {
		console.error('DELETE /api/catatan Error:', error);
		return NextResponse.json({ error: 'Gagal menghapus catatan' }, { status: 500 });
	}
}
