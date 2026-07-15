const fs = require('fs');
const file = 'src/app/kelas/[id]/laporan-absensi-mapel/page.jsx';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('return (');
const endIdx = content.lastIndexOf(');') + 2;

if (startIdx === -1 || endIdx < startIdx) {
	console.error('Batas penggantian tidak ditemukan!');
	process.exit(1);
}

const newReturn = `return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] pb-20 font-sans'>
			
			{/* Header Brutalist */}
			<div className='bg-[#8B5CF6] border-b-[4px] border-[#0D0D0D] pb-16 pt-10 px-4 sm:px-8 relative overflow-hidden'>
				<div className='absolute top-4 right-10 w-24 h-24 bg-[#F5C518] border-[4px] border-[#0D0D0D] rounded-full shadow-[4px_4px_0px_0px_#0D0D0D] rotate-12 hidden md:block'></div>
				<div className='absolute bottom-8 left-1/4 w-12 h-12 bg-[#00A693] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -rotate-12 hidden md:block'></div>

				<div className='max-w-7xl mx-auto relative z-10'>
					<div className='flex items-center gap-4 mb-8'>
						<button
							onClick={() => window.history.back()}
							className='p-3 bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] text-[#0D0D0D] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<svg className='w-8 h-8' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M15 19l-7-7 7-7'/></svg>
						</button>
						<div>
							<h1 className='text-3xl sm:text-5xl font-black text-white uppercase tracking-widest drop-shadow-[4px_4px_0px_#0D0D0D] mb-2'>
								LAPORAN ABSENSI
							</h1>
							<p className='text-[#0D0D0D] font-black tracking-widest uppercase bg-[#F5C518] inline-block px-3 py-1 border-[2px] border-[#0D0D0D] text-xs sm:text-sm shadow-[2px_2px_0px_0px_#0D0D0D]'>
								KELAS {namaKelas}
							</p>
						</div>
					</div>
				</div>
			</div>

			<div className='max-w-7xl mx-auto px-4 sm:px-8 -mt-8 relative z-20 space-y-10'>
				
				{/* Filter Section */}
				<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
					<div className='grid grid-cols-1 md:grid-cols-4 gap-6 items-end'>
						
						{/* Info Kelas */}
						<div>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>Kelas</label>
							<div className='w-full px-4 py-3 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black text-lg uppercase shadow-[4px_4px_0px_0px_#0D0D0D] pointer-events-none h-[3.25rem] flex items-center'>
								{namaKelas || '-'}
							</div>
						</div>

						{/* Pilih Mapel */}
						<div className='relative h-full'>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>Mata Pelajaran</label>
							<div className='absolute bottom-3 right-4 pointer-events-none'>
								<svg className='w-6 h-6 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7'/></svg>
							</div>
							<select
								value={selectedMapel}
								onChange={(e) => setSelectedMapel(e.target.value)}
								className='w-full h-[3.25rem] pl-4 pr-10 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none text-lg appearance-none cursor-pointer uppercase transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
								<option value=''>PILIH MAPEL</option>
								{mapelList.map((m) => (
									<option key={m.id} value={m.mapel}>{m.mapel}</option>
								))}
							</select>
						</div>

						{/* Pilih Bulan */}
						<div className='relative h-full'>
							<label className='block text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2'>Periode</label>
							<div className='absolute bottom-3 right-4 pointer-events-none'>
								<svg className='w-6 h-6 text-[#0D0D0D]' fill='none' stroke='currentColor' strokeWidth={4} viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' d='M19 9l-7 7-7-7'/></svg>
							</div>
							<select
								value={selectedBulan}
								onChange={(e) => setSelectedBulan(e.target.value)}
								className='w-full h-[3.25rem] pl-4 pr-10 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black shadow-[4px_4px_0px_0px_#0D0D0D] focus:shadow-[6px_6px_0px_0px_#0D0D0D] outline-none rounded-none text-lg appearance-none cursor-pointer uppercase transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D]'>
								<option value=''>PILIH BULAN</option>
								{bulanOptions.map((bulan) => (
									<option key={bulan.value} value={bulan.value}>{bulan.label}</option>
								))}
							</select>
						</div>

						{/* Tombol Tampilkan */}
						<div>
							<button
								onClick={fetchRekap}
								disabled={loading}
								className='w-full h-[3.25rem] bg-[#2F80ED] text-white border-[3px] border-[#0D0D0D] font-black uppercase tracking-widest text-lg shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed'>
								{loading ? 'MEMUAT...' : 'TAMPILKAN'}
							</button>
						</div>
					</div>

					{error && <div className='mt-6 bg-[#FF90E8] border-[3px] border-[#0D0D0D] p-4 text-[#0D0D0D] font-bold shadow-[4px_4px_0px_0px_#0D0D0D] uppercase text-sm'>{error}</div>}
				</div>

				{/* Table Section */}
				{rekapData && (
					<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D]'>
						
						{/* Table Header Banner */}
						<div className='bg-[#00A693] p-5 border-b-[4px] border-[#0D0D0D] flex flex-col lg:flex-row items-center justify-between gap-6'>
							<div className='flex flex-col items-center lg:items-start'>
								<h2 className='text-2xl font-black text-white uppercase tracking-widest drop-shadow-[2px_2px_0px_#0D0D0D]'>
									{rekapData.kelas} - {selectedMapel || 'MAPEL'}
								</h2>
								<div className='bg-[#F5C518] text-[#0D0D0D] px-3 py-1 font-bold text-xs uppercase border-[2px] border-[#0D0D0D] mt-2 shadow-[2px_2px_0px_0px_#0D0D0D]'>
									PERIODE: {rekapData.periode}
								</div>
							</div>

							<div className='flex flex-wrap items-center gap-4'>
								{/* Stats Box */}
								<div className='bg-white border-[3px] border-[#0D0D0D] px-4 py-2 flex items-center gap-3 shadow-[4px_4px_0px_0px_#0D0D0D]'>
									<div className='text-[10px] font-black uppercase text-[#0D0D0D]'>TOTAL SISWA</div>
									<div className='text-2xl font-black text-[#2F80ED] drop-shadow-[1px_1px_0px_#0D0D0D]'>{rekapData.siswa?.length || 0}</div>
								</div>

								{/* Toggle Tampilan */}
								<div className='flex bg-[#0D0D0D] border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
									<button
										onClick={() => setTampilanStyle('jumlah')}
										className={\`px-4 py-2 text-xs font-black uppercase transition-colors \${tampilanStyle === 'jumlah' ? 'bg-[#F5C518] text-[#0D0D0D]' : 'bg-transparent text-white hover:bg-gray-800'}\`}>
										JUMLAH
									</button>
									<button
										onClick={() => setTampilanStyle('persentase')}
										className={\`px-4 py-2 text-xs font-black uppercase transition-colors \${tampilanStyle === 'persentase' ? 'bg-[#F5C518] text-[#0D0D0D]' : 'bg-transparent text-white hover:bg-gray-800'}\`}>
										PERSENTASE
									</button>
								</div>

								{/* Export Button */}
								<button
									onClick={exportToExcel}
									className='flex items-center gap-2 px-4 py-2 bg-[#E8451A] text-white border-[3px] border-[#0D0D0D] font-black uppercase text-sm shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all'>
									<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='3' stroke='currentColor' className='w-5 h-5'><path strokeLinecap='round' strokeLinejoin='round' d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3'/></svg>
									EXPORT EXCEL
								</button>
							</div>
						</div>

						{rekapData.siswa && Array.isArray(rekapData.siswa) && rekapData.siswa.length > 0 ? (
							<div className='p-6'>
								{/* Legend Keterangan */}
								<div className='mb-6 flex flex-wrap gap-4'>
									<div className='flex items-center gap-2 bg-white px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='w-6 h-6 flex items-center justify-center bg-[#A3E635] text-[#0D0D0D] font-black text-xs border-[2px] border-[#0D0D0D]'>H</span>
										<span className='text-xs font-black uppercase text-[#0D0D0D]'>HADIR</span>
									</div>
									<div className='flex items-center gap-2 bg-white px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='w-6 h-6 flex items-center justify-center bg-[#2F80ED] text-white font-black text-xs border-[2px] border-[#0D0D0D]'>I</span>
										<span className='text-xs font-black uppercase text-[#0D0D0D]'>IZIN</span>
									</div>
									<div className='flex items-center gap-2 bg-white px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='w-6 h-6 flex items-center justify-center bg-[#F5C518] text-[#0D0D0D] font-black text-xs border-[2px] border-[#0D0D0D]'>S</span>
										<span className='text-xs font-black uppercase text-[#0D0D0D]'>SAKIT</span>
									</div>
									<div className='flex items-center gap-2 bg-white px-3 py-1.5 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
										<span className='w-6 h-6 flex items-center justify-center bg-[#E8451A] text-white font-black text-xs border-[2px] border-[#0D0D0D]'>A</span>
										<span className='text-xs font-black uppercase text-[#0D0D0D]'>ALPHA</span>
									</div>
								</div>

								{/* Table Container */}
								<div className='overflow-x-auto border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
									<table className='w-full min-w-max border-collapse'>
										<thead>
											<tr className='bg-[#0D0D0D] text-white'>
												<th className='border-b-[4px] border-r-[3px] border-[#0D0D0D] px-4 py-3 text-center text-xs font-black uppercase tracking-widest sticky left-0 z-20 bg-[#0D0D0D]'>NO</th>
												<th className='border-b-[4px] border-r-[3px] border-[#0D0D0D] px-6 py-3 text-left text-xs font-black uppercase tracking-widest'>NAMA SISWA</th>

												{/* Kolom Tanggal */}
												{getDatesInMonth(rekapData.tanggalList).map((tanggal) => {
													const date = new Date(tanggal);
													const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });
													const isWeekend = date.getDay() === 0 || date.getDay() === 6;

													return (
														<th key={tanggal} className={\`border-b-[4px] border-r-[2px] border-[#0D0D0D] px-2 py-3 text-center min-w-[50px] \${isWeekend ? 'bg-[#E8451A] text-white' : ''}\`}>
															<div className='text-sm font-black'>{date.getDate()}</div>
															<div className='text-[10px] font-bold uppercase mt-1'>{dayName}</div>
														</th>
													);
												})}

												{/* Kolom Ringkasan */}
												<th className='border-b-[4px] border-l-[4px] border-r-[2px] border-[#0D0D0D] bg-[#A3E635] text-[#0D0D0D] px-4 py-3 text-center text-xs font-black uppercase'>H</th>
												<th className='border-b-[4px] border-r-[2px] border-[#0D0D0D] bg-[#2F80ED] text-white px-4 py-3 text-center text-xs font-black uppercase'>I</th>
												<th className='border-b-[4px] border-r-[2px] border-[#0D0D0D] bg-[#F5C518] text-[#0D0D0D] px-4 py-3 text-center text-xs font-black uppercase'>S</th>
												<th className='border-b-[4px] border-[#0D0D0D] bg-[#E8451A] text-white px-4 py-3 text-center text-xs font-black uppercase'>A</th>
											</tr>
										</thead>
										<tbody className='bg-white'>
											{rekapData.siswa.map((siswa, index) => {
												const totalPertemuan = Math.max(rekapData.tanggalList ? rekapData.tanggalList.length : 1, 1);
												const renderNilai = (val) => {
													if (tampilanStyle === 'jumlah') return val;
													return Math.round((val / totalPertemuan) * 100) + '%';
												};

												return (
													<tr key={siswa.id} className='hover:bg-[#FFF5F0] transition-colors group'>
														<td className='border-b-[2px] border-r-[3px] border-[#0D0D0D] px-4 py-3 text-center font-bold text-sm sticky left-0 bg-white group-hover:bg-[#FFF5F0] z-10'>{index + 1}</td>
														<td className='border-b-[2px] border-r-[3px] border-[#0D0D0D] px-6 py-3'>
															<div className='flex items-center gap-4'>
																<div className='w-10 h-10 border-[3px] border-[#0D0D0D] bg-[#8B5CF6] flex items-center justify-center text-white font-black text-sm shadow-[2px_2px_0px_0px_#0D0D0D] flex-shrink-0'>
																	{siswa.nama_lengkap.charAt(0)}
																</div>
																<div>
																	<div className='text-sm font-black text-[#0D0D0D] uppercase'>{siswa.nama_lengkap}</div>
																	<div className='text-xs font-bold text-gray-600 bg-[#F5C518] border-[2px] border-[#0D0D0D] px-1 mt-1 inline-block'>NIS: {siswa.nis || '-'}</div>
																</div>
															</div>
														</td>

														{/* Data Per Tanggal */}
														{getDatesInMonth(rekapData.tanggalList).map((tanggal) => {
															const absensi = siswa.absensi && siswa.absensi[tanggal] ? siswa.absensi[tanggal] : null;
															const status = absensi?.status || '-';
															const kode = status === 'Hadir' ? 'H' : status === 'Izin' ? 'I' : status === 'Sakit' ? 'S' : (status === 'Alpha' || status === 'Alpa') ? 'A' : '-';

															let cellStyle = 'font-bold text-gray-400';
															let boxStyle = '';
															if (kode === 'H') { cellStyle = 'text-[#0D0D0D]'; boxStyle = 'bg-[#A3E635] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-[#0D0D0D]'; }
															else if (kode === 'I') { cellStyle = 'text-white'; boxStyle = 'bg-[#2F80ED] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-white'; }
															else if (kode === 'S') { cellStyle = 'text-[#0D0D0D]'; boxStyle = 'bg-[#F5C518] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-[#0D0D0D]'; }
															else if (kode === 'A') { cellStyle = 'text-white'; boxStyle = 'bg-[#E8451A] border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] text-white'; }

															return (
																<td key={tanggal} className='border-b-[2px] border-r-[2px] border-[#0D0D0D] px-2 py-3 text-center'>
																	<div className='flex justify-center'>
																		{kode !== '-' ? (
																			<span className={\`w-7 h-7 flex items-center justify-center text-xs font-black \${boxStyle}\`} title={absensi?.keterangan ? \`\${status} - \${absensi.keterangan}\` : status}>
																				{kode}
																			</span>
																		) : (
																			<span className={cellStyle}>{kode}</span>
																		)}
																	</div>
																</td>
															);
														})}

														{/* Ringkasan */}
														<td className='border-b-[2px] border-l-[4px] border-r-[2px] border-[#0D0D0D] px-3 py-3 text-center bg-[#A3E635]/20'>
															<span className='font-black text-sm text-[#0D0D0D]'>{renderNilai(siswa.ringkasan?.H || 0)}</span>
														</td>
														<td className='border-b-[2px] border-r-[2px] border-[#0D0D0D] px-3 py-3 text-center bg-[#2F80ED]/20'>
															<span className='font-black text-sm text-[#0D0D0D]'>{renderNilai(siswa.ringkasan?.I || 0)}</span>
														</td>
														<td className='border-b-[2px] border-r-[2px] border-[#0D0D0D] px-3 py-3 text-center bg-[#F5C518]/20'>
															<span className='font-black text-sm text-[#0D0D0D]'>{renderNilai(siswa.ringkasan?.S || 0)}</span>
														</td>
														<td className='border-b-[2px] border-[#0D0D0D] px-3 py-3 text-center bg-[#E8451A]/20'>
															<span className='font-black text-sm text-[#0D0D0D]'>{renderNilai(siswa.ringkasan?.A || 0)}</span>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						) : (
							<div className='p-16 text-center flex flex-col items-center justify-center relative overflow-hidden bg-white'>
								<div className='absolute -top-10 -right-10 w-40 h-40 bg-[#F5C518] rounded-full border-[4px] border-[#0D0D0D] opacity-20'></div>
								<div className='absolute -bottom-10 -left-10 w-40 h-40 bg-[#00A693] border-[4px] border-[#0D0D0D] rotate-45 opacity-20'></div>
								
								<div className='w-28 h-28 bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] flex items-center justify-center mx-auto mb-8 relative z-10 transform -rotate-3 hover:rotate-0 transition-transform'>
									<span className='text-6xl drop-shadow-[2px_2px_0px_#0D0D0D]'>📭</span>
								</div>
								<h3 className='text-3xl sm:text-4xl font-black text-[#0D0D0D] mb-4 uppercase tracking-widest relative z-10'>TIDAK ADA DATA ABSENSI</h3>
								<p className='text-[#0D0D0D] font-bold text-lg relative z-10 bg-[#F5C518] px-4 py-2 border-[3px] border-[#0D0D0D]'>Silakan pilih mata pelajaran dan periode yang valid.</p>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
`

content = content.substring(0, startIdx) + newReturn + '\n}\n';
fs.writeFileSync(file, content);
console.log('Successfully updated laporan-absensi-mapel page!');
