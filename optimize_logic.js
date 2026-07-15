const fs = require('fs');
const file = 'src/app/kelas/[id]/nilai/[tugasId]/edit/page.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetPart = `			let updatedCount = 0;
			for (const siswa of siswaList) {
				const idSiswa = siswa.id;
				const n = nilaiSiswa[idSiswa];
				const hasValidScore = n !== undefined && n !== null && String(n).trim() !== '';

				if (hasValidScore) {
					if (existingIds.has(idSiswa)) {
						await supabase.from('nilai_siswa').update({ nilai: n }).eq('tugas_id', tugasId).eq('siswa_id', idSiswa);
					} else if (siswaMap.has(idSiswa)) {
						await supabase.from('nilai_siswa').insert({
							tugas_id: tugasId,
							siswa_id: idSiswa,
							nama_siswa: siswaMap.get(idSiswa),
							nilai: n
						});
					}
					updatedCount++;
				} else {
					if (existingIds.has(idSiswa)) {
						await supabase.from('nilai_siswa').delete().eq('tugas_id', tugasId).eq('siswa_id', idSiswa);
					}
				}
			}`;

const optimizedPart = `			let updatedCount = 0;
			const promises = []; // Kumpulkan semua request ke array

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

			// Eksekusi semua request secara BERSAMAAN (Paralel)
			await Promise.all(promises);`;

// Instead of string match, use a robust replace
let updatedContent = content;
const startIdx = content.indexOf('let updatedCount = 0;');
const endStr = 'await Swal.fire({';
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const before = content.substring(0, startIdx);
    const after = content.substring(endIdx);
    updatedContent = before + optimizedPart + '\\n\\n\\t\\t\\t' + after;
    fs.writeFileSync(file, updatedContent);
    console.log('Optimization applied successfully!');
} else {
    console.log('Could not find markers to apply optimization.');
}
