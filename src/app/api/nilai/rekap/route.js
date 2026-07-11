import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(req) {
	try {
		const { searchParams } = new URL(req.url);
		const kelas = searchParams.get('kelas');
		const bulan = searchParams.get('bulan');
		const tahun = searchParams.get('tahun') || new Date().getFullYear();
		const mapel = searchParams.get('mapel');

		if (!kelas || !bulan) {
			return NextResponse.json({ error: 'Parameter kelas dan bulan harus diisi' }, { status: 400 });
		}

		const supabase = await createClient();

		// 1. Ambil data siswa aktif di kelas
		const { data: siswaDiKelas, error: siswaError } = await supabase
			.from('siswa')
			.select('id, nis, nama_lengkap, kelas')
			.eq('kelas', kelas)
			.eq('status', 'Aktif');

		if (siswaError) throw siswaError;

		// 2. Ambil data tugas (header)
		let queryTugas = supabase
			.from('nilai_tugas')
			.select('tugas_id, kategori, type, mapel, tanggal')
			.eq('kelas', kelas);

		if (mapel) {
			queryTugas = queryTugas.eq('mapel', mapel);
		}

		const { data: semuaTugas, error: tugasError } = await queryTugas;
		if (tugasError) throw tugasError;

		// Filter tugas by bulan/tahun
		const tugasFiltered = (semuaTugas || []).filter((t) => {
			if (!t.tanggal) return false;
			const tanggalObj = new Date(t.tanggal);
			const bulanTanggal = tanggalObj.getMonth() + 1;
			const tahunTanggal = tanggalObj.getFullYear();

			if (bulan === 'all') {
				return tahunTanggal === parseInt(tahun);
			} else {
				return bulanTanggal === parseInt(bulan) && tahunTanggal === parseInt(tahun);
			}
		});

		// 3. Jika ada tugas, ambil nilai-nilainya
		let nilaiSiswaRaw = [];
		if (tugasFiltered.length > 0) {
			const tugasIds = tugasFiltered.map(t => t.tugas_id);
			const { data: nilaiData, error: nilaiError } = await supabase
				.from('nilai_siswa')
				.select('tugas_id, siswa_id, nilai')
				.in('tugas_id', tugasIds);
				
			if (nilaiError) throw nilaiError;
			nilaiSiswaRaw = nilaiData || [];
		}

		// Sort tugas by tanggal
		const tugasList = tugasFiltered.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));

		// 4. Proses rekap per siswa (Matrix build)
		const rekapSiswa = (siswaDiKelas || []).map((siswa) => {
			const nilaiSiswa = {};
			let totalNilai = 0;
			let countNilai = 0;

			// Filter nilai just for this student
			const studentGrades = nilaiSiswaRaw.filter(n => String(n.siswa_id) === String(siswa.id));
			
			studentGrades.forEach((grade) => {
				if (grade.nilai) {
					const val = parseFloat(grade.nilai || 0);
					nilaiSiswa[grade.tugas_id] = val;
					totalNilai += val;
					countNilai++;
				}
			});

			const avg = countNilai > 0 ? totalNilai / countNilai : 0;

			return {
				...siswa,
				nilai: nilaiSiswa,
				avg: avg,
				countNilai: countNilai,
			};
		});

		// 5. Format periode
		const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		const periode = bulan === 'all' ? `Semua Bulan ${tahun}` : `${namaBulan[parseInt(bulan) - 1]} ${tahun}`;

		return NextResponse.json({
			kelas,
			periode,
			mapel: mapel || 'Semua Mapel',
			tugasList,
			siswa: rekapSiswa,
			totalSiswa: rekapSiswa.length,
			totalTugas: tugasList.length,
		});
	} catch (error) {
		console.error('❌ Error fetching rekap nilai:', error);
		return NextResponse.json({ error: 'Gagal mengambil data rekap', details: error.message }, { status: 500 });
	}
}
