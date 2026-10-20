/**
 * Role Constants & Permissions Helper — Guru App
 */

export const ROLES = {
	ADMIN: 'Admin',
	GURU: 'Guru',
	KEPALA_SEKOLAH: 'Kepala Sekolah',
	BENDAHARA: 'Bendahara',
	KESISWAAN: 'Kesiswaan',
	KURIKULUM: 'Kurikulum',
	WALI_KELAS: 'Wali Kelas',
	WALI_MURID: 'Wali Murid',
	KEAMANAN: 'Keamanan',
	GURU_BK: 'Guru BK',
	TATA_USAHA: 'Tata Usaha',
	SISWA: 'Siswa',
};

// Pengelompokan Role
export const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.KEPALA_SEKOLAH, ROLES.BENDAHARA, ROLES.KESISWAAN, ROLES.KURIKULUM];
export const READ_ALL_ROLES = [ROLES.ADMIN, ROLES.KEPALA_SEKOLAH, ROLES.KESISWAAN, ROLES.KURIKULUM];
export const DISCIPLINE_MANAGERS = [ROLES.ADMIN, ROLES.KESISWAAN];
export const ACADEMIC_MANAGERS = [ROLES.ADMIN, ROLES.KURIKULUM, ROLES.KEPALA_SEKOLAH];

// Warna badge konsisten Neobrutalism
export const ROLE_BADGE_STYLES = {
	[ROLES.ADMIN]: {
		bg: 'bg-rose-400 text-white',
		border: 'border-rose-500',
		icon: '👑',
		label: 'Administrator',
	},
	[ROLES.KEPALA_SEKOLAH]: {
		bg: 'bg-indigo-300 text-black',
		border: 'border-indigo-400',
		icon: '🎓',
		label: 'Kepala Sekolah',
	},
	[ROLES.KURIKULUM]: {
		bg: 'bg-amber-300 text-black',
		border: 'border-amber-400',
		icon: '📐',
		label: 'Waka Kurikulum',
	},
	[ROLES.BENDAHARA]: {
		bg: 'bg-teal-300 text-black',
		border: 'border-teal-400',
		icon: '💼',
		label: 'Bendahara',
	},
	[ROLES.KESISWAAN]: {
		bg: 'bg-violet-300 text-black',
		border: 'border-violet-400',
		icon: '🛡️',
		label: 'Kesiswaan',
	},
	[ROLES.GURU]: {
		bg: 'bg-emerald-300 text-black',
		border: 'border-emerald-400',
		icon: '👨‍🏫',
		label: 'Guru Pengajar',
	},
};
