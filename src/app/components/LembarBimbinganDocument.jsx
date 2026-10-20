'use client';

// ============================================================================
// KOMPONEN LEMBAR DOKUMEN LAPORAN & BERITA ACARA BIMBINGAN SANTRI RESMI
// Digunakan bersama untuk Preview Modal di Layar dan Format Cetak Murni A4
// ============================================================================
export default function LembarBimbinganDocument({ printItem, schoolProfile = {}, allSiswa = [] }) {
	if (!printItem) return null;

	const siswaDetail = (allSiswa || []).find((s) => String(s.id) === String(printItem.siswa_id));
	const nisSantri = siswaDetail?.nis || '—';
	const dateObj = printItem.tanggal_bimbingan ? new Date(printItem.tanggal_bimbingan) : new Date();
	const formattedDateFull = dateObj.toLocaleDateString('id-ID', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
	const formattedDateShort = dateObj.toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	});
	const regNumber = `REG-KSW/${dateObj.getFullYear()}/${String(printItem.id).padStart(4, '0')}`;

	return (
		<div className='w-full text-black font-sans bg-white'>
			{/* 1. KOP SURAT SEKOLAH / PESANTREN RESMI */}
			<div className='border-b-2 border-black pb-2 mb-3'>
				<div className='flex items-center justify-between gap-3'>
					{/* Logo Kiri */}
					<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
						{schoolProfile.logo_kiri ? (
							/* eslint-disable-next-line @next/next/no-img-element */
							<img
								src={schoolProfile.logo_kiri}
								alt='Logo Sekolah'
								className='max-w-full max-h-full object-contain'
							/>
						) : (
							<div className='w-14 h-14 bg-gray-50 border border-gray-400 rounded-lg flex items-center justify-center font-bold text-[9px] text-gray-500 text-center leading-tight p-1'>
								LOGO SEKOLAH
							</div>
						)}
					</div>

					{/* Teks Lembaga & Sekolah */}
					<div className='flex-1 text-center px-1'>
						<p className='text-xs font-black uppercase tracking-wider text-gray-800 leading-tight'>
							{schoolProfile.kementerian || 'YAYASAN AL-ISHLAH KUALA GADING'}
						</p>
						<h1 className='text-base sm:text-lg font-black uppercase tracking-tight text-black leading-tight mt-0.5'>
							{schoolProfile.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
						</h1>
						<p className='text-[10px] font-bold text-gray-700 font-mono mt-0.5'>
							NPSN: {schoolProfile.npsn || '69953165'} {schoolProfile.akreditasi ? `• Akreditasi: ${schoolProfile.akreditasi}` : ''}
						</p>
						<p className='text-[9.5px] text-gray-600 mt-0.5 leading-tight'>
							{schoolProfile.alamat || 'Jl. Perintis Desa Kuala Gading, Kec. Batang Cenaku, Kab. Indragiri Hulu, Riau Kode Pos 29355'}
						</p>
						<div className='flex flex-wrap items-center justify-center gap-x-2 text-[9px] text-gray-600 mt-0.5'>
							{schoolProfile.telepon && <span>Telp/WA: {schoolProfile.telepon}</span>}
							{schoolProfile.telepon && schoolProfile.email && <span>•</span>}
							{schoolProfile.email && <span>Email: {schoolProfile.email}</span>}
							{schoolProfile.website && <span>•</span>}
							{schoolProfile.website && <span>Website: {schoolProfile.website}</span>}
						</div>
					</div>

					{/* Logo Kanan */}
					<div className='w-16 h-16 shrink-0 flex items-center justify-center'>
						{schoolProfile.logo_kanan ? (
							/* eslint-disable-next-line @next/next/no-img-element */
							<img
								src={schoolProfile.logo_kanan}
								alt='Logo Kanan'
								className='max-w-full max-h-full object-contain'
							/>
						) : (
							<div className='w-14 h-14 bg-gray-50 border border-gray-400 rounded-lg flex items-center justify-center font-bold text-[9px] text-gray-500 text-center leading-tight p-1'>
								LOGO KESISWAAN
							</div>
						)}
					</div>
				</div>

				{/* Garis Ganda Kop Surat Resmi */}
				<div className='mt-2 space-y-0.5'>
					<div className='border-b-2 border-black'></div>
					<div className='border-b border-black/70'></div>
				</div>
			</div>

			{/* 2. JUDUL DOKUMEN & NOMOR REGISTRASI */}
			<div className='text-center my-2.5'>
				<h2 className='text-sm sm:text-base font-black uppercase tracking-wider text-black underline underline-offset-4 decoration-2'>
					BERITA ACARA & LEMBAR LAPORAN BIMBINGAN SANTRI
				</h2>
				<p className='text-[10px] font-black uppercase text-gray-700 tracking-wider mt-1'>
					UNIT KESISWAAN & BIMBINGAN KONSELING (BK)
				</p>
				<div className='inline-flex items-center gap-3 text-[10px] font-mono text-gray-700 mt-1.5 px-3 py-0.5 bg-gray-100 rounded border border-gray-300'>
					<span><b>No:</b> {regNumber}</span>
					<span>•</span>
					<span><b>Tanggal:</b> {formattedDateFull}</span>
				</div>
			</div>

			{/* 3. BAGIAN I: DATA IDENTITAS SANTRI */}
			<div className='mt-3'>
				<div className='bg-gray-100 border border-black px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-black flex items-center justify-between'>
					<span>I. IDENTITAS SANTRI TERBINA</span>
					<span className='font-mono text-[9.5px] font-bold text-gray-700'>Status: {printItem.status}</span>
				</div>
				<table className='w-full text-xs border-x border-b border-black'>
					<tbody>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 w-1/4 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Nama Lengkap Santri
							</td>
							<td className='py-1.5 px-3 w-3/4 font-black text-black'>
								{printItem.nama_santri}
							</td>
						</tr>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Nomor Induk Siswa (NIS)
							</td>
							<td className='py-1.5 px-3 font-mono font-bold text-black'>
								{nisSantri}
							</td>
						</tr>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Kelas / Rombongan Belajar
							</td>
							<td className='py-1.5 px-3 font-bold text-black'>
								Kelas {printItem.kelas}
							</td>
						</tr>
						<tr>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Wali Kelas Pembina
							</td>
							<td className='py-1.5 px-3 font-bold text-black'>
								{printItem.wali_kelas_nama || '—'}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* 4. BAGIAN II: URAIAN PERKARA & KEDISIPLINAN */}
			<div className='mt-3'>
				<div className='bg-gray-100 border border-black px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-black'>
					II. PERKARA KEDISIPLINAN & KETIDAKHADIRAN
				</div>
				<table className='w-full text-xs border-x border-b border-black'>
					<tbody>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 w-1/4 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Jenis Pelanggaran
							</td>
							<td className='py-1.5 px-3 w-3/4 font-black text-rose-700'>
								{printItem.jenis_pelanggaran}
							</td>
						</tr>
						<tr className='border-b border-gray-300'>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Akumulasi Alfa / Kejadian
							</td>
							<td className='py-1.5 px-3 font-bold text-black font-mono'>
								{printItem.jumlah_alpa} Kali / Jam Pelajaran Alfa
							</td>
						</tr>
						<tr>
							<td className='py-1.5 px-3 font-bold text-gray-700 bg-gray-50 border-r border-gray-300'>
								Rekomendasi Tindak Lanjut
							</td>
							<td className='py-1.5 px-3 font-bold text-black'>
								{printItem.rekomendasi_tindak_lanjut || 'Pembinaan Wali Kelas'}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* 5. BAGIAN III: TINDAKAN PEMBINAAN & CATATAN EVALUASI */}
			<div className='mt-3'>
				<div className='bg-gray-100 border border-black px-2.5 py-1 text-[10.5px] font-black uppercase tracking-wider text-black'>
					III. BENTUK PEMBINAAN & HASIL BIMBINGAN
				</div>
				<div className='border-x border-b border-black p-2.5 space-y-2 text-xs'>
					<div>
						<p className='font-bold text-gray-700 text-[10.5px] uppercase'>
							A. Tindakan / Bentuk Penanganan yang Telah Dilakukan:
						</p>
						<p className='mt-0.5 text-black font-semibold pl-2 border-l-2 border-black leading-relaxed'>
							{printItem.bentuk_penanganan}
						</p>
					</div>

					<div>
						<p className='font-bold text-gray-700 text-[10.5px] uppercase'>
							B. Hasil Evaluasi & Catatan Bimbingan:
						</p>
						<p className='mt-0.5 text-black font-medium pl-2 border-l-2 border-gray-400 leading-relaxed'>
							{printItem.hasil_catatan}
						</p>
					</div>

					{printItem.catatan_kesiswaan && (
						<div>
							<p className='font-bold text-gray-700 text-[10.5px] uppercase'>
								C. Catatan Khusus Staf Kesiswaan:
							</p>
							<p className='mt-0.5 text-black font-medium pl-2 border-l-2 border-yellow-500 leading-relaxed bg-yellow-50/50 p-1 rounded'>
								{printItem.catatan_kesiswaan}
							</p>
						</div>
					)}
				</div>
			</div>

			{/* 6. BAGIAN IV: PERNYATAAN & KOMITMEN SANTRI */}
			<div className='mt-3'>
				<div className='border border-black p-2 bg-gray-50 text-[10px] leading-relaxed text-gray-800 rounded'>
					<p className='font-black text-black uppercase text-[9.5px] tracking-wide mb-0.5'>
						Pernyataan & Janji Komitmen Santri:
					</p>
					<p className='italic'>
						&ldquo;Saya yang bertanda tangan di bawah ini menyatakan dengan sesungguhnya telah menerima bimbingan dan pembinaan terkait kedisiplinan tersebut di atas. Saya berjanji sungguh-sungguh untuk mentaati seluruh tata tertib madrasah dan pesantren, tidak mengulangi pelanggaran serupa, rajin mengikuti KBM, serta bersedia menerima sanksi yang lebih tegas apabila di kemudian hari melanggar kembali.&rdquo;
					</p>
				</div>
			</div>

			{/* 7. BAGIAN V: PENGESAHAN TIGA PIHAK (KOLOM TANDA TANGAN) */}
			<div className='mt-3 pt-1'>
				<div className='text-right text-xs font-semibold text-gray-800 mb-1.5'>
					Kuala Gading, {formattedDateShort}
				</div>

				<div className='grid grid-cols-3 gap-3 text-center text-xs'>
					{/* Pihak 1: Santri */}
					<div className='flex flex-col justify-between'>
						<div>
							<p className='font-bold text-black text-[10.5px]'>Santri yang Dibina,</p>
							<p className='text-[9px] text-gray-500'>(Pembuat Komitmen)</p>
						</div>
						<div className='h-12'></div>
						<div>
							<p className='font-black text-black border-t border-black/70 pt-1'>
								{printItem.nama_santri}
							</p>
							<p className='text-[9px] text-gray-600 font-mono'>NIS: {nisSantri}</p>
						</div>
					</div>

					{/* Pihak 2: Wali Kelas */}
					<div className='flex flex-col justify-between'>
						<div>
							<p className='font-bold text-black text-[10.5px]'>Wali Kelas / Pembina,</p>
							<p className='text-[9px] text-gray-500'>(Mengetahui & Membina)</p>
						</div>
						<div className='h-12'></div>
						<div>
							<p className='font-black text-black border-t border-black/70 pt-1'>
								{printItem.wali_kelas_nama || 'Wali Kelas'}
							</p>
							<p className='text-[9px] text-gray-600'>Wali Kelas {printItem.kelas}</p>
						</div>
					</div>

					{/* Pihak 3: Kesiswaan */}
					<div className='flex flex-col justify-between'>
						<div>
							<p className='font-bold text-black text-[10.5px]'>Bagian Kesiswaan / BK,</p>
							<p className='text-[9px] text-gray-500'>(Mengesahkan)</p>
						</div>
						<div className='h-12'></div>
						<div>
							<p className='font-black text-black border-t border-black/70 pt-1'>
								Staf Kesiswaan
							</p>
							<p className='text-[9px] text-gray-600'>Unit Kesiswaan & Kedisiplinan</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
