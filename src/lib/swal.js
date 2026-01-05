import Swal from 'sweetalert2';

export const swalProcess = (title = 'Memproses...', text = 'Mohon tunggu') =>
	Swal.fire({
		title,
		text,
		allowOutsideClick: false,
		allowEscapeKey: false,
		showConfirmButton: false,
		didOpen: () => Swal.showLoading(),
	});

export const swalSuccess = (title, text, timer = 1500) => Swal.fire({ icon: 'success', title, text, timer, showConfirmButton: false });

export const swalError = (title, text, timer = 2500) => Swal.fire({ icon: 'error', title, text, timer, showConfirmButton: false });

export const swalConfirmDelete = (title = 'Hapus data?', text = 'Tindakan ini tidak bisa dibatalkan.') =>
	Swal.fire({
		title,
		text,
		icon: 'warning',
		showCancelButton: true,
		confirmButtonText: 'Ya, hapus',
		cancelButtonText: 'Batal',
		confirmButtonColor: '#dc2626',
	});
