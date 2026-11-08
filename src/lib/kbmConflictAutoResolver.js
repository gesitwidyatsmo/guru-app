import { supabaseAdmin } from '@/utils/supabase/admin';
import { checkJamOverlap } from '@/lib/absensiUtils';

/**
 * Otomatis mengesahkan (auto-approve) draft antrean bentrok yang kini slotnya sudah bebas
 * akibat guru rekan memindahkan kelasnya, memindahkan jam mengajarnya, atau menghapus jurnalnya.
 *
 * @param {Object} params
 * @param {string} params.sourceJournalId - ID jurnal yang baru saja diupdate/dihapus
 * @param {Object} params.oldData - Data jurnal sebelum diupdate/dihapus (kelas, tanggal, jam_ke, guru_id)
 * @param {Object} [params.newData] - Data baru jika update (kelas, jam_ke). Jika delete, kosongkan.
 * @param {string} [params.actionType='update'] - 'update' atau 'delete'
 */
export async function autoResolveFreedDrafts({ sourceJournalId, oldData, newData = {}, actionType = 'update' }) {
	try {
		if (!oldData || !oldData.kelas || !oldData.tanggal) return;

		const oldKelas = oldData.kelas;
		const oldTanggal = oldData.tanggal;
		const oldJamKe = oldData.jam_ke;
		const newKelas = newData.kelas || oldKelas;
		const newJamKe = newData.jam_ke || oldJamKe;

		// Jika aksi update tapi kelas dan jam sama sekali tidak berubah, tidak ada slot yang dibebaskan
		if (actionType === 'update' && newKelas === oldKelas && newJamKe === oldJamKe) {
			return;
		}

		// 1. Cari draft antrean bentrok yang berpotensi bebas:
		// A. Draft yang secara eksplisit mencatat konflik_dengan_id = sourceJournalId
		// B. Atau draft yang berada di kelas & tanggal lama KBM tersebut
		const { data: potentialDrafts, error: fetchErr } = await supabaseAdmin
			.from('jurnal')
			.select('*, users!jurnal_guru_id_fkey(nama_lengkap)')
			.eq('status_verifikasi', 'draft_bentrok')
			.eq('tanggal', oldTanggal)
			.or(`konflik_dengan_id.eq.${sourceJournalId},kelas.eq.${oldKelas}`);

		if (fetchErr || !potentialDrafts || potentialDrafts.length === 0) return;

		// Ambil nama guru sumber yang memindahkan/menghapus jadwal
		let sourceTeacherName = 'Guru rekan';
		if (oldData.guru_id) {
			const { data: userProf } = await supabaseAdmin
				.from('users')
				.select('nama_lengkap')
				.eq('id_user', oldData.guru_id)
				.maybeSingle();
			if (userProf?.nama_lengkap) sourceTeacherName = userProf.nama_lengkap;
		}

		const nowStr = new Date().toLocaleString('id-ID');

		for (const draft of potentialDrafts) {
			// 2. Ambil KBM aktif di kelas & tanggal draft tersebut (abaikan draft antrean lain)
			const { data: classJournals } = await supabaseAdmin
				.from('jurnal')
				.select('id, jam_ke, mapel, guru_id, status_verifikasi, status_kehadiran, users!jurnal_guru_id_fkey(nama_lengkap)')
				.eq('kelas', draft.kelas)
				.eq('tanggal', draft.tanggal)
				.neq('id', draft.id);

			const activeJournals = (classJournals || []).filter(
				(j) =>
					j.status_verifikasi !== 'draft_bentrok' &&
					!String(j.status_kehadiran || '').toLowerCase().includes('draft bentrok')
			);

			// 3. Cek apakah ada KBM aktif yang tumpang tindih dengan draft.jam_ke
			const overlap = activeJournals.find((j) => checkJamOverlap(j.jam_ke, draft.jam_ke).isOverlap);

			// 4. Jika slot jam di kelas draft kini sudah 100% BEBAS:
			// OTOMATIS SAHKAN JURNAL TERSEBUT!
			if (!overlap) {
				let explanation = '';
				if (actionType === 'delete') {
					explanation = `${sourceTeacherName} telah menghapus jadwal KBM-nya yang sebelumnya bertabrakan`;
				} else if (newKelas !== oldKelas) {
					explanation = `${sourceTeacherName} telah memindahkan KBM ke kelas ${newKelas} (sebelumnya salah pilih kelas)`;
				} else {
					explanation = `${sourceTeacherName} telah memindahkan KBM ke Jam ${newJamKe}`;
				}

				const approvePayload = {
					status_verifikasi: 'disetujui',
					status_kehadiran: 'Normal',
					catatan_admin: `Otomatis disahkan oleh sistem pada ${nowStr}: Slot kelas ${draft.kelas} (Jam ${draft.jam_ke}) telah bebas karena ${explanation}.`,
				};

				await supabaseAdmin
					.from('jurnal')
					.update(approvePayload)
					.eq('id', draft.id);

				console.log(
					`[AutoResolve] Draft Jurnal ID ${draft.id} (${draft.mapel} kelas ${draft.kelas} Jam ${draft.jam_ke}) berhasil otomatis disahkan karena ${explanation}.`
				);
			}
		}
	} catch (error) {
		console.warn('Error inside autoResolveFreedDrafts:', error);
	}
}
