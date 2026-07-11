import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const generateId = () => Math.random().toString(36).substr(2, 9);

export async function GET(request) {
	try {
		const supabase = await createClient();
		const role = request.headers.get('x-user-role');
		const userId = request.headers.get('x-user-id');
		const { searchParams } = new URL(request.url);
		const showAll = searchParams.get('all') === 'true';

		let allowedMapels = null;

		if (showAll || role === 'Admin') {
			allowedMapels = null; // Semua mapel
		} else if (role === 'Guru' && userId) {
			const { data: kbmData } = await supabase
				.from('guru_kbm')
				.select('mapel')
				.eq('id_user', userId);
			
			if (kbmData) {
				allowedMapels = [...new Set(kbmData.map(r => r.mapel))];
			} else {
				allowedMapels = [];
			}
		} else {
			allowedMapels = [];
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

		return NextResponse.json(mapelData);
	} catch (error) {
		console.error('Error GET Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request) {
	if (request.headers.get('x-user-role') !== 'Admin') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { mapel } = body;

		if (!mapel) {
			return NextResponse.json({ error: 'Nama mapel wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { error } = await supabase.from('mapel').insert({
			id: generateId(),
			mapel,
		});

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama mapel sudah ada' }, { status: 409 });
			}
			throw error;
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error POST Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function PUT(request) {
	if (request.headers.get('x-user-role') !== 'Admin') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const body = await request.json();
		const { id, mapel } = body;

		if (!id || !mapel) {
			return NextResponse.json({ error: 'ID dan nama mapel wajib diisi' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { error } = await supabase.from('mapel').update({ mapel }).eq('id', id);

		if (error) {
			if (error.code === '23505') {
				return NextResponse.json({ error: 'Nama mapel sudah ada' }, { status: 409 });
			}
			throw error;
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error PUT Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function DELETE(request) {
	if (request.headers.get('x-user-role') !== 'Admin') {
		return NextResponse.json({ error: 'Akses Ditolak (Khusus Admin)' }, { status: 403 });
	}
	try {
		const { id } = await request.json();
		if (!id) {
			return NextResponse.json({ error: 'ID wajib diisi.' }, { status: 400 });
		}

		const supabase = await createClient();
		
		const { error } = await supabase.from('mapel').delete().eq('id', id);

		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Error DELETE Mapel:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
