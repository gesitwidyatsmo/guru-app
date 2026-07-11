import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function PATCH(req, { params }) {
	try {
		const userId = req.headers.get('x-user-id');
		const { id } = await params;

		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const supabase = await createClient();
		
		// Verifikasi kepemilikan notifikasi (meskipun di RLS sudah aman, ini validasi ekstra)
		const { data: notif } = await supabase
			.from('notifikasi')
			.select('user_id')
			.eq('id', id)
			.single();

		if (!notif || notif.user_id !== userId) {
			return NextResponse.json({ error: 'Not Found or Forbidden' }, { status: 403 });
		}

		const { error } = await supabase
			.from('notifikasi')
			.update({ is_read: true })
			.eq('id', id);

		if (error) throw error;

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('PATCH Notifikasi Error:', error);
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
	}
}
