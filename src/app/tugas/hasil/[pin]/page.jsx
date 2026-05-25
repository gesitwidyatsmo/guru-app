'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, FileText, CheckCircle, Clock } from 'lucide-react';
import Loader from '../../../components/loading';

export default function HasilTugas({ params }) {
	const unwrappedParams = use(params);
	const pin = unwrappedParams.pin;

	const [submissions, setSubmissions] = useState([]);
	const [loading, setLoading] = useState(true);
	const [filterKelas, setFilterKelas] = useState('Semua');
	
	// Untuk modal teks panjang
	const [selectedText, setSelectedText] = useState(null);

	useEffect(() => {
		const fetchHasil = async () => {
			try {
				const res = await fetch(`/api/tugas-online/hasil?pin=${pin}`);
				if (res.ok) {
					const data = await res.json();
					setSubmissions(data);
				}
			} catch (error) {
				console.error('Failed to fetch submissions', error);
			} finally {
				setLoading(false);
			}
		};

		fetchHasil();
	}, [pin]);

	if (loading) return <Loader />;

	const uniqueKelas = ['Semua', ...new Set(submissions.map(s => s.kelas).filter(k => k && k !== '-'))].sort();
	const filteredSubmissions = filterKelas === 'Semua' 
		? submissions 
		: submissions.filter(s => s.kelas === filterKelas);

	return (
		<main className='min-h-screen bg-gray-50 py-8'>
			<div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
				
				{/* Header */}
				<div className='mb-8 flex flex-col sm:flex-row sm:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-gray-200 gap-4'>
					<div className='flex items-center gap-4'>
						<Link
							href='/tugas'
							className='p-2 rounded-xl bg-gray-50 shadow-sm border border-gray-200 hover:bg-gray-100 transition-colors'>
							<ChevronLeft className='w-6 h-6 text-gray-600' />
						</Link>
						<div>
							<h1 className='text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3'>
								Hasil Pengumpulan
								<span className="text-sm font-bold bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg uppercase tracking-wider">{pin}</span>
							</h1>
							<p className='text-gray-500 text-sm sm:text-base mt-1'>Total terkumpul: <strong className="text-gray-800">{submissions.length} siswa</strong></p>
						</div>
					</div>

					{uniqueKelas.length > 1 && (
						<div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
							<label className="text-sm font-semibold text-gray-600 whitespace-nowrap">Filter Kelas:</label>
							<select 
								value={filterKelas}
								onChange={(e) => setFilterKelas(e.target.value)}
								className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block w-full p-2 outline-none font-medium cursor-pointer min-w-[120px]"
							>
								{uniqueKelas.map(k => (
									<option key={k} value={k}>{k}</option>
								))}
							</select>
						</div>
					)}
				</div>

				{/* Tabel Data */}
				<div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
					{filteredSubmissions.length > 0 ? (
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse">
								<thead>
									<tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm">
										<th className="p-4 font-semibold w-16 text-center">Absen</th>
										<th className="p-4 font-semibold">Nama Siswa</th>
										<th className="p-4 font-semibold">Kelas</th>
										<th className="p-4 font-semibold">Waktu Kumpul</th>
										{submissions.some(s => s.nilai) && <th className="p-4 font-semibold text-center w-24 text-indigo-700">Nilai</th>}
										<th className="p-4 font-semibold">Jawaban Teks</th>
										<th className="p-4 font-semibold text-center w-32">File Lampiran</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-gray-100">
									{filteredSubmissions.map((sub, idx) => (
										<tr key={idx} className="hover:bg-indigo-50/30 transition-colors group">
											<td className="p-4 text-center font-bold text-gray-700">{sub.absen}</td>
											<td className="p-4 font-medium text-gray-900">{sub.nama}</td>
											<td className="p-4">
												{sub.kelas && sub.kelas !== '-' ? (
													<span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
														{sub.kelas}
													</span>
												) : (
													<span className="text-gray-400">-</span>
												)}
											</td>
											<td className="p-4 text-sm text-gray-500 flex items-center gap-1.5">
												<Clock className="w-4 h-4 text-gray-400" />
												{sub.waktu}
											</td>
											{submissions.some(s => s.nilai) && (
												<td className="p-4 text-center">
													{sub.nilai ? (
														<span className="inline-flex items-center justify-center font-bold text-lg text-indigo-700 bg-indigo-50 w-12 h-12 rounded-xl">
															{sub.nilai}
														</span>
													) : (
														<span className="text-gray-400">-</span>
													)}
												</td>
											)}
											<td className="p-4">
												{sub.teks ? (
													<div className="max-w-xs sm:max-w-md">
														<p className="text-sm text-gray-700 line-clamp-2">{sub.teks}</p>
														{sub.teks.length > 80 && (
															<button 
																onClick={() => setSelectedText({nama: sub.nama, teks: sub.teks})}
																className="text-xs text-indigo-600 font-semibold mt-1 hover:underline"
															>
																Baca selengkapnya
															</button>
														)}
													</div>
												) : (
													<span className="text-xs text-gray-400 italic">Tidak ada teks</span>
												)}
											</td>
											<td className="p-4 text-center">
												{sub.file ? (
													<a
														href={sub.file}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-sm font-semibold transition-colors"
													>
														<Download className="w-4 h-4" /> Buka
													</a>
												) : (
													<span className="text-xs text-gray-400">-</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<div className="p-16 flex flex-col items-center justify-center text-center">
							<div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
								<FileText className="w-8 h-8 text-gray-400" />
							</div>
							<h3 className="text-lg font-bold text-gray-800 mb-1">Belum ada pengumpulan</h3>
							<p className="text-gray-500">Belum ada siswa yang mengirim tugas dengan PIN ini.</p>
						</div>
					)}
				</div>

			</div>

			{/* Modal Teks Panjang */}
			{selectedText && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
					<div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
						<div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
							<h3 className="font-bold text-gray-800 flex items-center gap-2">
								<FileText className="w-5 h-5 text-indigo-500" />
								Jawaban: {selectedText.nama}
							</h3>
							<button 
								onClick={() => setSelectedText(null)}
								className="text-gray-400 hover:text-gray-600 font-bold text-xl px-2"
							>
								&times;
							</button>
						</div>
						<div className="p-6 max-h-[60vh] overflow-y-auto">
							<p className="text-gray-700 whitespace-pre-wrap">{selectedText.teks}</p>
						</div>
						<div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
							<button 
								onClick={() => setSelectedText(null)}
								className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-colors"
							>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
