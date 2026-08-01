import Link from 'next/link';

export const metadata = {
	title: 'Offline | Guru App',
	description: 'Anda sedang offline',
};

export default function OfflinePage() {
	return (
		<div className="min-h-[100dvh] bg-neo-cream flex flex-col items-center justify-center p-6 text-center">
			<div className="neo-card max-w-md w-full flex flex-col items-center">
				<div className="w-24 h-24 mb-6 text-neo-orange">
					<svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3" />
					</svg>
				</div>
				<h1 className="text-3xl font-black mb-4">Anda Sedang Offline</h1>
				<p className="text-gray-600 mb-8 font-medium">
					Sepertinya Anda kehilangan koneksi internet. Beberapa fitur yang tidak memerlukan internet (seperti draft pengerjaan soal) mungkin masih tersimpan, tetapi untuk membuka halaman ini Anda perlu terhubung kembali ke jaringan.
				</p>
				<button 
					onClick={() => window.location.reload()} 
					className="neo-btn-primary w-full text-center flex justify-center items-center gap-2"
				>
					<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					Coba Lagi
				</button>
			</div>
		</div>
	);
}
