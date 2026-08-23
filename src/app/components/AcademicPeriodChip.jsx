'use client';

import { useState, useRef, useEffect } from 'react';
import { useAcademic } from '@/context/AcademicContext';

/**
 * AcademicPeriodChip
 * Chip kecil bergaya Neobrutalism di header setiap halaman.
 * Menampilkan periode aktif yang sedang dilihat dan memungkinkan user untuk menggantinya.
 */
export default function AcademicPeriodChip() {
	const {
		tahunAjar,
		semester,
		setPeriode,
		tahunAjarAktif,
		semesterAktif,
		isViewingActive,
		daftarTahunAjar,
		isLoading,
	} = useAcademic();

	const [isOpen, setIsOpen] = useState(false);
	const dropdownRef = useRef(null);

	// Tutup dropdown saat klik di luar
	useEffect(() => {
		function handleClickOutside(e) {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
				setIsOpen(false);
			}
		}
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

	if (isLoading) {
		return (
			<div className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] bg-white animate-pulse rounded-lg">
				<div className="w-20 h-3 bg-gray-200 rounded" />
			</div>
		);
	}

	// Label: versi pendek untuk mobile, versi lengkap untuk md+
	const chipLabelShort = `${tahunAjar.split('/')[0]} · S${semester}`;
	const chipLabelFull = `TA ${tahunAjar} · Sem ${semester}`;

	// Warna chip berdasarkan status
	const isActive = isViewingActive;

	return (
		<div className="relative inline-block" ref={dropdownRef}>
			{/* Chip Button */}
			<button
				onClick={() => setIsOpen(!isOpen)}
				className={`
					inline-flex items-center gap-1.5 border-[2px] border-[#0D0D0D] font-black uppercase tracking-widest
					transition-all duration-150 select-none cursor-pointer rounded-lg
					text-[10px] px-2.5 py-1.5 md:text-xs md:px-3 md:py-1.5
					${isActive
						? 'bg-[#00A693] text-white shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-x-[1px] hover:-translate-y-[1px]'
						: 'bg-[#F5C518] text-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-x-[1px] hover:-translate-y-[1px]'
					}
					active:translate-x-[1px] active:translate-y-[1px] active:shadow-none
				`}
				title={isActive ? 'Periode aktif saat ini' : 'Sedang melihat data arsip'}
			>
				{/* Icon kalender */}
				<svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
				</svg>

				{/* Label pendek di mobile, full di md+ */}
				<span className="md:hidden">{chipLabelShort}</span>
				<span className="hidden md:inline">{chipLabelFull}</span>

				{/* Badge ARSIP */}
				{!isActive && (
					<span className="hidden md:inline-block text-[9px] bg-[#0D0D0D] text-white px-1 py-0.5 rounded-sm font-black tracking-wider">
						ARSIP
					</span>
				)}

				{/* Chevron */}
				<svg
					className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
					fill="none" stroke="currentColor" viewBox="0 0 24 24"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
				</svg>
			</button>

			{/* Dropdown */}
			{isOpen && (
				<div className="absolute right-0 top-full mt-2 w-[260px] md:w-[280px] bg-white border-[2px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] z-50 overflow-hidden rounded-lg">
					{/* Header dropdown */}
					<div className="px-4 py-2.5 border-b-[2px] border-[#0D0D0D] bg-[#F5C518]">
						<p className="text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest">📅 Pilih Periode Tampil</p>
					</div>

					{/* List periode */}
					<div className="max-h-56 overflow-y-auto">
						{daftarTahunAjar.length === 0 ? (
							<div className="px-4 py-4 text-xs text-gray-500 text-center font-semibold">
								Belum ada periode tersimpan
							</div>
						) : (
							daftarTahunAjar.map((item) => {
								const isSelected = item.nama === tahunAjar && Number(item.semester) === semester;
								const isAktifDB = item.is_aktif;

								return (
									<button
										key={item.id}
										onClick={() => {
											setPeriode(item.nama, Number(item.semester));
											setIsOpen(false);
										}}
										className={`
											w-full flex items-center justify-between px-4 py-3 text-xs font-bold transition-all border-b border-gray-100 last:border-b-0
											${isSelected
												? 'bg-[#0D0D0D] text-white'
												: 'text-[#0D0D0D] hover:bg-[#FFF5F0]'
											}
										`}
									>
										<span className="uppercase tracking-wide">
											TA {item.nama} · Sem {item.semester}
										</span>
										<div className="flex items-center gap-1.5">
											{isAktifDB && (
												<span className={`text-[9px] font-black px-1.5 py-0.5 border uppercase tracking-wider rounded-sm
													${isSelected ? 'bg-white text-[#00A693] border-white' : 'bg-[#00A693] text-white border-[#00A693]'}
												`}>
													AKTIF
												</span>
											)}
											{isSelected && (
												<svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
													<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
												</svg>
											)}
										</div>
									</button>
								);
							})
						)}
					</div>

					{/* Footer: kembali ke aktif (hanya saat melihat arsip) */}
					{!isViewingActive && (
						<div className="border-t-[2px] border-[#0D0D0D] px-4 py-2.5 bg-[#FFF5F0]">
							<button
								onClick={() => {
									setPeriode(tahunAjarAktif, Number(semesterAktif));
									setIsOpen(false);
								}}
								className="w-full flex items-center justify-center gap-1.5 text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest py-1.5 px-3 border-[2px] border-[#0D0D0D] bg-white shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all rounded-lg"
							>
								↩ Kembali ke Periode Aktif
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * ArchiveBanner
 * Banner bergaya Neobrutalism yang muncul saat user melihat periode arsip.
 * Render ini di setiap halaman yang perlu.
 */
export function ArchiveBanner() {
	const { isViewingActive, tahunAjar, semester, resetKeAktif } = useAcademic();

	if (isViewingActive) return null;

	return (
		<div className="flex items-center justify-between gap-3 px-4 py-2.5 md:px-5 md:py-3 bg-[#F5C518] border-b-[3px] border-[#0D0D0D]">
			<div className="flex items-center gap-2 min-w-0">
				{/* Icon */}
				<span className="text-base flex-shrink-0">📂</span>
				<p className="text-[11px] md:text-xs font-black text-[#0D0D0D] uppercase tracking-wide leading-snug">
					<span className="hidden sm:inline">Sedang melihat data arsip — </span>
					<span className="font-black">TA {tahunAjar} Sem {semester}</span>
					<span className="hidden md:inline font-bold"> · Data ini adalah riwayat, bukan periode aktif</span>
				</p>
			</div>
			<button
				onClick={resetKeAktif}
				className="flex-shrink-0 text-[10px] font-black text-[#0D0D0D] uppercase tracking-widest border-[2px] border-[#0D0D0D] px-2.5 py-1.5 bg-white shadow-[2px_2px_0px_0px_#0D0D0D] hover:shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all rounded-lg"
			>
				↩ Ke Aktif
			</button>
		</div>
	);
}
