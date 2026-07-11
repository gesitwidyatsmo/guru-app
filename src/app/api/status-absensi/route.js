import { NextResponse } from 'next/server';

const defaultStatuses = [
	{ id: '1', kode: 'H', label: 'Hadir', warna: 'green' }, // emerald-500
	{ id: '2', kode: 'I', label: 'Izin', warna: 'blue' }, // blue-500
	{ id: '3', kode: 'S', label: 'Sakit', warna: 'yellow' }, // amber-500
	{ id: '4', kode: 'A', label: 'Alpa', warna: 'red' }, // red-500
];

export async function GET() {
	try {
		return NextResponse.json(defaultStatuses);
	} catch (error) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
