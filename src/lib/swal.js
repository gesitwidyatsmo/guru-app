import Swal from 'sweetalert2';

const neoSwal = Swal.mixin({
	customClass: {
		popup: 'bg-white border-[3px] border-black shadow-[8px_8px_0px_0px_#0D0D0D] rounded-2xl !p-6',
		title: 'text-xl font-black uppercase text-black !mb-2',
		htmlContainer: 'text-base font-bold text-gray-800',
		confirmButton: 'bg-black text-white border-2 border-black font-bold uppercase tracking-wide px-6 py-2 rounded-lg shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all mx-2',
		cancelButton: 'bg-gray-200 text-black border-2 border-black font-bold uppercase tracking-wide px-6 py-2 rounded-lg shadow-[4px_4px_0px_0px_#0D0D0D] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all mx-2',
		icon: '!border-[3px] !border-black'
	},
	buttonsStyling: false,
});

export const swalProcess = (title = 'Memproses...', text = 'Mohon tunggu') =>
	neoSwal.fire({
		title,
		text,
		allowOutsideClick: false,
		allowEscapeKey: false,
		showConfirmButton: false,
		didOpen: () => Swal.showLoading(),
	});

export const swalSuccess = (title, text, timer = 1500) => neoSwal.fire({ icon: 'success', title, text, timer, showConfirmButton: false });

export const swalError = (title, text, timer = 2500) => neoSwal.fire({ icon: 'error', title, text, timer, showConfirmButton: false });

export const swalConfirmDelete = (title = 'Hapus data?', text = 'Tindakan ini tidak bisa dibatalkan.') =>
	neoSwal.fire({
		title,
		text,
		icon: 'warning',
		showCancelButton: true,
		confirmButtonText: 'Ya, hapus',
		cancelButtonText: 'Batal',
	});
