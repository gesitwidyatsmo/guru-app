import Swal from 'sweetalert2';

export const neoSwal = Swal.mixin({
	customClass: {
		popup: 'bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] rounded-2xl !p-6',
		title: 'text-xl font-black uppercase text-black !mb-2',
		htmlContainer: 'text-base font-bold text-gray-800',
		confirmButton: 'bg-black text-white border-2 border-black font-bold uppercase tracking-wide px-6 py-2 rounded-lg shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all mx-2 disabled:opacity-50 disabled:cursor-not-allowed',
		cancelButton: 'bg-gray-200 text-black border-2 border-black font-bold uppercase tracking-wide px-6 py-2 rounded-lg shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all mx-2 disabled:opacity-50 disabled:cursor-not-allowed',
		icon: '!border-[3px] !border-black',
		loader: '!border-[3px] !border-black !border-t-transparent'
	},
	buttonsStyling: false,
});

export const swalProcess = (title = 'Memproses...', text = 'Mohon tunggu, sedang menghubungi server...') =>
	neoSwal.fire({
		title,
		text,
		allowOutsideClick: false,
		allowEscapeKey: false,
		showConfirmButton: false,
		didOpen: () => Swal.showLoading(),
	});

export const swalLoading = swalProcess;
export const swalClose = () => Swal.close();

export const swalSuccess = (title = 'Berhasil!', text = '', timer = 2000) =>
	neoSwal.fire({
		icon: 'success',
		title,
		text,
		timer,
		showConfirmButton: false,
		timerProgressBar: true,
	});

export const swalError = (title = 'Gagal!', text = '', timer = 3000) =>
	neoSwal.fire({
		icon: 'error',
		title,
		text,
		timer,
		showConfirmButton: false,
		timerProgressBar: true,
	});

export const swalConfirmDelete = (title = 'Hapus data?', text = 'Tindakan ini tidak bisa dibatalkan.') =>
	neoSwal.fire({
		title,
		text,
		icon: 'warning',
		showCancelButton: true,
		confirmButtonText: 'Ya, hapus',
		cancelButtonText: 'Batal',
	});

/**
 * Konfirmasi Aksi Asinkron Standar dengan Loading Built-in (showLoaderOnConfirm)
 * Mencegah modal tertutup seketika sebelum fetch/query selesai.
 */
export const swalConfirmAsync = async ({
	title = 'Konfirmasi?',
	text = 'Apakah Anda yakin ingin melanjutkan?',
	html,
	icon = 'warning',
	confirmText = 'Ya, Lanjutkan',
	cancelText = 'Batal',
	actionFn,
}) => {
	return neoSwal.fire({
		title,
		text: html ? undefined : text,
		html,
		icon,
		showCancelButton: true,
		confirmButtonText: confirmText,
		cancelButtonText: cancelText,
		showLoaderOnConfirm: true,
		allowOutsideClick: () => !Swal.isLoading(),
		preConfirm: async () => {
			try {
				if (typeof actionFn === 'function') {
					return await actionFn();
				}
				return true;
			} catch (err) {
				Swal.showValidationMessage(err.message || 'Terjadi kesalahan pada server/jaringan.');
				return false;
			}
		},
	});
};

/**
 * Konfirmasi Hapus Data Asinkron Standar dengan Loading Built-in
 */
export const swalConfirmDeleteAsync = async ({
	title = 'Hapus data?',
	text = 'Tindakan ini tidak bisa dibatalkan.',
	html,
	confirmText = 'Ya, Hapus',
	cancelText = 'Batal',
	actionFn,
}) => {
	return swalConfirmAsync({
		title,
		text,
		html,
		icon: 'warning',
		confirmText,
		cancelText,
		actionFn,
	});
};
