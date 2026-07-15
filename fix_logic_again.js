const fs = require('fs');
const file = 'src/app/kelas/[id]/nilai/[tugasId]/edit/page.jsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = '\tconst handleSubmit = async (e) => {';
const endStr = '\tconst filteredSiswa = ';

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx === -1 || endIdx === -1) {
    console.error('Batas penggantian tidak ditemukan!');
    process.exit(1);
}

const newHandleSubmit = `	const handleSubmit = async (e) => {
		e.preventDefault();

		// Konfirmasi
		const result = await Swal.fire({
			title: 'Update Nilai?',
			text: 'Nilai yang diubah akan tersimpan',
			icon: 'question',
			showCancelButton: true,
			confirmButtonColor: '#4F46E5',
			cancelButtonColor: '#6B7280',
			confirmButtonText: 'Ya, Update',
			cancelButtonText: 'Batal',
		});

		if (!result.isConfirmed) return;

		setSaving(true);

		try {
			const supabase = createClient();
			const { data: { user } } = await supabase.auth.getUser();
			const { data: userData } = await supabase.from('users').select('role, id_user').eq('auth_id', user?.id).single();
			const role = userData?.role;
			const userId = userData?.id_user;

			// Verify
			const { data: existingTugas, error: fetchError } = await supabase.from('nilai_tugas').select('guru_id').eq('tugas_id', tugasId).single();
			if (fetchError || !existingTugas) throw new Error('Tugas tidak ditemukan');

			if (role === 'Guru' && userId) {
				if (existingTugas.guru_id && existingTugas.guru_id !== userId) {
					throw new Error('Akses Ditolak: Anda mencoba menyunting Tugas buatan kolega.');
				}
				const { data: isAllowed } = await supabase.from('guru_kbm').select('id_kbm').eq('id_user', userId).eq('kelas', kelas).eq('mapel', mapel).single();
				if (!isAllowed) throw new Error('Akses Ditolak: Modifikasi tugas di luar yurisdiksi kelas ini dilarang.');
			}

			// Update Header
			const updates = { kategori: judul, tanggal: tanggal };
			const { error: updateError } = await supabase.from('nilai_tugas').update(updates).eq('tugas_id', tugasId);
			if (updateError) throw updateError;

			// Update students
			const { data: existingGrades } = await supabase.from('nilai_siswa').select('siswa_id').eq('tugas_id', tugasId);
			const existingIds = new Set((existingGrades || []).map(g => g.siswa_id));
			
			const siswaIdsToUpdate = siswaList.map(s => s.id).filter(id => {
				const n = nilaiSiswa[id];
				return n !== undefined && n !== null && String(n).trim() !== '';
			});

			const newSiswaIds = siswaIdsToUpdate.filter(id => !existingIds.has(id));
			let siswaMap = new Map();
			if (newSiswaIds.length > 0) {
				const { data: siswaData } = await supabase.from('siswa').select('id, nama_lengkap').in('id', newSiswaIds);
				siswaMap = new Map((siswaData || []).map(s => [s.id, s.nama_lengkap]));
			}

			let updatedCount = 0;
			const promises = [];

			for (const siswa of siswaList) {
				const idSiswa = siswa.id;
				const n = nilaiSiswa[idSiswa];
				const hasValidScore = n !== undefined && n !== null && String(n).trim() !== '';

				if (hasValidScore) {
					if (existingIds.has(idSiswa)) {
						promises.push(supabase.from('nilai_siswa').update({ nilai: n }).eq('tugas_id', tugasId).eq('siswa_id', idSiswa));
					} else if (siswaMap.has(idSiswa)) {
						promises.push(supabase.from('nilai_siswa').insert({
							tugas_id: tugasId,
							siswa_id: idSiswa,
							nama_siswa: siswaMap.get(idSiswa),
							nilai: n
						}));
					}
					updatedCount++;
				} else {
					if (existingIds.has(idSiswa)) {
						promises.push(supabase.from('nilai_siswa').delete().eq('tugas_id', tugasId).eq('siswa_id', idSiswa));
					}
				}
			}

			await Promise.all(promises);

			await Swal.fire({
				icon: 'success',
				title: 'Berhasil!',
				text: \`\${updatedCount} nilai berhasil diperbarui\`,
				confirmButtonColor: '#4F46E5',
				timer: 2000,
				timerProgressBar: true,
			});

			router.push(\`/kelas/\${id}/nilai/\${tugasId}\`);
		} catch (error) {
			console.error('Error updating nilai:', error);
			Swal.fire({
				icon: 'error',
				title: 'Gagal Memperbarui',
				text: error.message,
				confirmButtonColor: '#4F46E5',
			});
		} finally {
			setSaving(false);
		}
	};

`;

content = content.substring(0, startIdx) + newHandleSubmit + content.substring(endIdx);
fs.writeFileSync(file, content);
console.log('Fully replaced handleSubmit logic with Promise.all!');
