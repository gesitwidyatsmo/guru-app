'use client';

import { useState, useEffect, useCallback } from 'react';
import {
	Printer,
	BookOpen,
	User,
	Award,
	CheckCircle2,
	ChevronRight,
	AlertCircle,
	MapPin,
	Calendar,
	Edit2,
	RotateCcw,
	AlertTriangle,
	Check,
} from 'lucide-react';
import Loader from '@/app/components/loading';

// Helper Deteksi Tingkat Kelas (7, 8, atau 9)
export const getTingkatKelas = (kelasName = '') => {
	const str = String(kelasName || '').trim().toUpperCase();
	if (!str) return 7;
	const clean = str.replace(/^(KELAS|ROMBEL|TINGKAT|SMP)\s+/i, '').trim();
	if (clean.startsWith('VIII') || /^8([^0-9]|$)/.test(clean) || /\b(VIII|8)\b/.test(clean)) return 8;
	if (clean.startsWith('IX') || /^9([^0-9]|$)/.test(clean) || /\b(IX|9)\b/.test(clean)) return 9;
	if (clean.startsWith('VII') || /^7([^0-9]|$)/.test(clean) || /\b(VII|7)\b/.test(clean)) return 7;
	return 7;
};

// Helper Default Tab Sheet: Kelas 7 = 'semua' (Buku Lengkap), Kelas 8 & 9 = 'semester' (Nilai Semester)
export const getDefaultSheetByKelas = (kelasName = '') => {
	const tingkat = getTingkatKelas(kelasName);
	return tingkat === 7 ? 'semua' : 'semester';
};

export default function CetakRaporPage() {
	const [kelasList, setKelasList] = useState([]);
	const [selectedKelasId, setSelectedKelasId] = useState('');
	const [selectedSiswaId, setSelectedSiswaId] = useState('');

	// Periode
	const [tahunAjaran, setTahunAjaran] = useState('2026/2027');
	const [semester, setSemester] = useState(1);

	const [bundleData, setBundleData] = useState(null);
	const [loading, setLoading] = useState(true);

	// Tampilan Halaman yang Dipilih: 'semua' | 'cover' | 'sekolah' | 'biodata' | 'semester' | 'nilai1' | 'nilai2' | 'ekskul'
	const [activeSheet, setActiveSheet] = useState('semua');

	// Penyesuaian Titimangsa Sesi Cetak (Override fleksibel)
	const [customTanggalRapor, setCustomTanggalRapor] = useState('');
	const [customTempatRapor, setCustomTempatRapor] = useState('');
	const [isEditingTitimangsa, setIsEditingTitimangsa] = useState(false);

	useEffect(() => {
		async function fetchMaster() {
			try {
				const [resKelas, resTahun, resMyClass] = await Promise.all([
					fetch('/api/kelas?only_wali=true'),
					fetch('/api/tahun-ajar'),
					fetch('/api/wali-kelas/my-class').catch(() => null),
				]);

				let listK = [];
				if (resKelas.ok) {
					listK = (await resKelas.json()) || [];
				}

				if (listK.length === 0 && resMyClass && resMyClass.ok) {
					const myC = await resMyClass.json();
					if (myC?.kelas) {
						listK = [myC.kelas];
					}
				}

				setKelasList(listK);
				if (listK.length > 0) {
					const firstKelas = listK[0];
					setSelectedKelasId(firstKelas.id);
					const defaultTab = getDefaultSheetByKelas(firstKelas.nama_kelas || firstKelas.kelas);
					setActiveSheet(defaultTab);
				}

				if (resTahun.ok) {
					const dataT = await resTahun.json();
					const aktif = dataT.find((t) => t.is_aktif) || dataT[0];
					if (aktif) {
						setTahunAjaran(aktif.nama || '2026/2027');
						setSemester(aktif.semester || 1);
					}
				}
			} catch (err) {
				console.error('Error fetching master:', err);
			} finally {
				setLoading(false);
			}
		}
		fetchMaster();
	}, []);

	const fetchRaporData = useCallback(async () => {
		if (!selectedKelasId) return;
		try {
			setLoading(true);
			const url = `/api/erapor/cetak?kelas_id=${selectedKelasId}&semester=${semester}&tahun_ajaran=${tahunAjaran}`;
			const res = await fetch(url);
			if (res.ok) {
				const json = await res.json();
				setBundleData(json);
				if (json.students && json.students.length > 0) {
					setSelectedSiswaId((prev) => {
						if (prev === 'ALL') return 'ALL';
						const exists = json.students.some((s) => s.siswa.id === prev);
						return exists ? prev : json.students[0].siswa.id;
					});
				}
			}
		} catch (err) {
			console.error('Error fetching cetak data:', err);
		} finally {
			setLoading(false);
		}
	}, [selectedKelasId, semester, tahunAjaran]);

	useEffect(() => {
		fetchRaporData();
	}, [fetchRaporData]);

	const students = bundleData?.students || [];
	const displayedBundles =
		selectedSiswaId === 'ALL'
			? students
			: students.filter((s) => s.siswa.id === selectedSiswaId).length > 0
			? students.filter((s) => s.siswa.id === selectedSiswaId)
			: students.slice(0, 1);
	const sekolah = bundleData?.sekolah || {};

	// Titimangsa Aktif (Dukungan Smart Fallback & Override Sesi)
	const tempatRaporDisplay = customTempatRapor || sekolah.tempat_rapor || 'Kuala Gading';
	const tanggalRaporDisplay = customTanggalRapor || sekolah.tanggal_rapor || '';
	const isOfficialDate = !customTanggalRapor && Boolean(bundleData?.sekolah?.is_titimangsa_official);

	// Deteksi Kelas & Tingkat yang Sedang Aktif
	const currentKelasObj =
		kelasList.find((k) => String(k.id) === String(selectedKelasId)) || (kelasList.length > 0 ? kelasList[0] : null);
	const currentKelasName =
		currentKelasObj?.nama_kelas ||
		currentKelasObj?.kelas ||
		bundleData?.students?.[0]?.kelas?.nama_kelas ||
		bundleData?.students?.[0]?.siswa?.kelas ||
		'';
	const currentTingkat = getTingkatKelas(currentKelasName);

	// Helper Class Capaian Kompetensi (Adaptasi persis dari Project Rapor)
	const getCapaianClass = (text) => {
		if (!text) return 'p-1.5 text-[10pt] leading-[1.4]';
		const len = String(text).length;
		if (len > 200) {
			return 'p-1 text-[9.5pt] leading-[1.3]';
		} else if (len > 120) {
			return 'p-1.5 text-[10pt] leading-[1.35]';
		}
		return 'p-1.5 text-[10pt] leading-[1.4]';
	};

	// Helper Format Tanggal Indonesia
	const formatDateIndo = (dateStr) => {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr;
			const months = [
				'Januari',
				'Februari',
				'Maret',
				'April',
				'Mei',
				'Juni',
				'Juli',
				'Agustus',
				'September',
				'Oktober',
				'November',
				'Desember',
			];
			return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
		} catch {
			return dateStr;
		}
	};

	// --- A. Cover Rapor (Sampul Depan Rapor) ---
	const renderCoverPage = (bundle) => (
		<div
			className='rapor-page bg-white mx-auto border-4 border-[#0a0a0a] rounded-2xl shadow-[12px_12px_0px_0px_#0a0a0a] transition-all flex flex-col justify-between items-center text-center'
			style={{
				width: '210mm',
				height: '297mm',
				minHeight: '297mm',
				maxHeight: '297mm',
				padding: '24mm 15mm 18mm',
				boxSizing: 'border-box',
				fontFamily: 'Arial, Helvetica, sans-serif',
				color: 'black',
				position: 'relative',
			}}>
			<div className='space-y-2 mt-2'>
				<h1 className='text-[18pt] font-black uppercase tracking-wider m-0 leading-tight'>
					RAPOR
				</h1>
				<h2 className='text-[15pt] font-black uppercase tracking-wide m-0 leading-tight'>
					{sekolah.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
				</h2>
			</div>

			<div className='my-auto flex flex-col items-center justify-center'>
				<div className='w-[240px] h-[240px] flex items-center justify-center p-2'>
					<img
						src='/logo smp.png'
						alt='Logo Sekolah'
						className='w-full h-full object-contain'
						onError={(e) => {
							e.target.src = '/logo_kiri.png';
						}}
					/>
				</div>
			</div>

			<div className='w-full flex flex-col items-center my-6 space-y-4'>
				<div className='w-full max-w-[400px] text-center space-y-1.5'>
					<p className='text-[13pt] font-bold text-gray-900'>Nama Peserta Didik :</p>
					<div className='border-3 border-black py-2.5 px-4 bg-white'>
						<p className='text-[13pt] font-black uppercase tracking-wide text-black m-0'>
							{bundle.siswa.nama_lengkap}
						</p>
					</div>
				</div>

				<div className='w-full max-w-[400px] text-center space-y-1.5'>
					<p className='text-[13pt] font-bold text-gray-900'>NIS / NISN :</p>
					<div className='border-3 border-black py-2.5 px-4 bg-white'>
						<p className='text-[13pt] font-black tracking-wider text-black m-0'>
							{bundle.siswa.nis || '-'} / {bundle.siswa.nisn || '-'}
						</p>
					</div>
				</div>
			</div>

			<div className='mt-auto pt-6 text-center space-y-1 w-full'>
				<h3 className='text-[13pt] font-black uppercase tracking-wider m-0'>
					KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH
				</h3>
				<h4 className='text-[12pt] font-black uppercase tracking-wider m-0 text-black'>
					REPUBLIK INDONESIA
				</h4>
			</div>
		</div>
	);

	// --- B. Identitas Satuan Pendidikan (Data Sekolah) ---
	const renderSchoolIdentityPage = () => (
		<div
			className='rapor-page bg-white mx-auto border-4 border-[#0a0a0a] rounded-2xl shadow-[12px_12px_0px_0px_#0a0a0a] transition-all flex flex-col justify-between'
			style={{
				width: '210mm',
				height: '297mm',
				minHeight: '297mm',
				maxHeight: '297mm',
				padding: '20mm 15mm',
				boxSizing: 'border-box',
				fontFamily: 'Arial, Helvetica, sans-serif',
				color: 'black',
				position: 'relative',
			}}>
			<div>
				<div className='text-center mb-8 space-y-1'>
					<h1 className='text-[16pt] font-black uppercase tracking-wide m-0'>
						RAPOR
					</h1>
					<h2 className='text-[14pt] font-black uppercase tracking-wide m-0'>
						{sekolah.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
					</h2>
				</div>

				<table className='w-full border-collapse text-[11pt] font-sans' style={{ lineHeight: '1.8' }}>
					<tbody>
						<tr>
							<td className='py-1 font-bold align-top' style={{ width: '230px' }}>
								Nama Satuan Pendidikan
							</td>
							<td className='py-1 text-center align-top' style={{ width: '20px' }}>
								:
							</td>
							<td className='py-1 font-bold uppercase align-top'>
								{sekolah.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
							</td>
						</tr>
						<tr>
							<td className='py-1 font-bold align-top'>NPSN</td>
							<td className='py-1 text-center align-top'>:</td>
							<td className='py-1 font-mono align-top'>{sekolah.npsn || '69953165'}</td>
						</tr>
						<tr>
							<td className='py-1 font-bold align-top'>NIS / NSS / NDS</td>
							<td className='py-1 text-center align-top'>:</td>
							<td className='py-1 font-mono align-top'>{sekolah.nis_nss_nds || '-'}</td>
						</tr>
						<tr>
							<td colSpan='3' className='pt-2 pb-0.5 font-bold uppercase'>
								Alamat
							</td>
						</tr>
						<tr>
							<td className='py-0.5 pl-4 font-normal align-top'>Satuan Pendidikan</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top leading-snug'>{sekolah.alamat || '-'}</td>
						</tr>
						<tr>
							<td className='py-0.5 pl-4 font-normal align-top'>Kelurahan / Desa</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>{sekolah.kelurahan_desa || '-'}</td>
						</tr>
						<tr>
							<td className='py-0.5 pl-4 font-normal align-top'>Kecamatan</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>{sekolah.kecamatan || '-'}</td>
						</tr>
						<tr>
							<td className='py-0.5 pl-4 font-normal align-top'>Kota / Kabupaten</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>{sekolah.kota_kabupaten || '-'}</td>
						</tr>
						<tr>
							<td className='py-0.5 pl-4 font-normal align-top'>Provinsi</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>{sekolah.provinsi || '-'}</td>
						</tr>
						<tr>
							<td className='py-1 font-bold align-top'>Website</td>
							<td className='py-1 text-center align-top'>:</td>
							<td className='py-1 font-mono text-blue-900 align-top'>{sekolah.website || '-'}</td>
						</tr>
						<tr>
							<td className='py-1 font-bold align-top'>E-mail</td>
							<td className='py-1 text-center align-top'>:</td>
							<td className='py-1 font-mono text-blue-900 align-top'>{sekolah.email || '-'}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);

	// --- C. Identitas Peserta Didik (Biodata Siswa) ---
	const renderStudentBiodataPage = (bundle) => {
		const s = bundle.siswa || {};
		return (
			<div
				className='rapor-page bg-white mx-auto border-4 border-[#0a0a0a] rounded-2xl shadow-[12px_12px_0px_0px_#0a0a0a] transition-all flex flex-col'
				style={{
					width: '210mm',
					height: '297mm',
					minHeight: '297mm',
					maxHeight: '297mm',
					padding: '14mm 14mm 18mm',
					boxSizing: 'border-box',
					fontFamily: 'Arial, Helvetica, sans-serif',
					fontSize: '9.5pt',
					color: 'black',
					position: 'relative',
				}}>
				<div>
					<div className='text-center mb-3 pb-1'>
						<h2 className='text-[12pt] font-black uppercase tracking-wider m-0'>
							IDENTITAS PESERTA DIDIK
						</h2>
					</div>

					<table className='w-full border-collapse' style={{ lineHeight: '1.45' }}>
						<tbody>
							<tr>
								<td className='py-0.5 align-top font-bold' style={{ width: '24px' }}>1.</td>
								<td className='py-0.5 align-top' style={{ width: '220px' }}>Nama Peserta Didik (Lengkap)</td>
								<td className='py-0.5 text-center align-top' style={{ width: '15px' }}>:</td>
								<td className='py-0.5 align-top font-bold uppercase'>{s.nama_lengkap}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>2.</td>
								<td className='py-0.5 align-top'>Nomor Induk / NISN</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top font-mono'>{s.nis || '-'} / {s.nisn || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>3.</td>
								<td className='py-0.5 align-top'>Tempat Tanggal Lahir</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top'>{s.tempat_lahir || '-'}, {formatDateIndo(s.tanggal_lahir)}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>4.</td>
								<td className='py-0.5 align-top'>Jenis Kelamin</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top'>{s.jenis_kelamin || (s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan')}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>5.</td>
								<td className='py-0.5 align-top'>Agama</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top'>{s.agama || 'Islam'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>6.</td>
								<td className='py-0.5 align-top'>Status dalam Keluarga</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top'>{s.status_dalam_keluarga || 'Anak Kandung'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>7.</td>
								<td className='py-0.5 align-top'>Anak ke</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top'>{s.anak_ke || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>8.</td>
								<td className='py-0.5 align-top'>Alamat Peserta Didik</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top leading-snug'>{s.alamat || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>9.</td>
								<td className='py-0.5 align-top'>Nomor Telepon</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top font-mono'>{s.telepon_siswa || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>10.</td>
								<td className='py-0.5 align-top'>Sekolah Asal</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top'>{s.sekolah_asal || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>11.</td>
								<td className='py-0.5 align-top' colSpan='3'>Diterima di sekolah ini</td>
							</tr>
							<tr>
								<td></td>
								<td className='py-0.5 pl-4'>Di kelas</td>
								<td className='py-0.5 text-center'>:</td>
								<td className='py-0.5'>{s.diterima_di_kelas || bundle.kelas.nama_kelas || '-'}</td>
							</tr>
							<tr>
								<td></td>
								<td className='py-0.5 pl-4'>Pada tanggal</td>
								<td className='py-0.5 text-center'>:</td>
								<td className='py-0.5'>{formatDateIndo(s.diterima_pada_tanggal) || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>12.</td>
								<td className='py-0.5 align-top' colSpan='3'>Nama Orang Tua</td>
							</tr>
							<tr>
								<td></td>
								<td className='py-0.5 pl-4'>a. Ayah</td>
								<td className='py-0.5 text-center'>:</td>
								<td className='py-0.5 font-bold'>{s.nama_ayah || '-'}</td>
							</tr>
							<tr>
								<td></td>
								<td className='py-0.5 pl-4'>b. Ibu</td>
								<td className='py-0.5 text-center'>:</td>
								<td className='py-0.5 font-bold'>{s.nama_ibu || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>13.</td>
								<td className='py-0.5 align-top'>Alamat Orang Tua</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top leading-snug'>{s.alamat_orang_tua || s.alamat || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top'></td>
								<td className='py-0.5 align-top'>Nomor Telepon Orang Tua</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 font-mono'>{s.telepon_orang_tua || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>14.</td>
								<td className='py-0.5 align-top' colSpan='3'>Pekerjaan Orang Tua</td>
							</tr>
							<tr>
								<td></td>
								<td className='py-0.5 pl-4'>a. Ayah</td>
								<td className='py-0.5 text-center'>:</td>
								<td className='py-0.5'>{s.pekerjaan_ayah || '-'}</td>
							</tr>
							<tr>
								<td></td>
								<td className='py-0.5 pl-4'>b. Ibu</td>
								<td className='py-0.5 text-center'>:</td>
								<td className='py-0.5'>{s.pekerjaan_ibu || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>15.</td>
								<td className='py-0.5 align-top'>Nama Wali Peserta Didik</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5'>{s.wali_siswa || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>16.</td>
								<td className='py-0.5 align-top'>Alamat Wali Peserta Didik</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 align-top leading-snug'>{s.alamat_wali || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top'></td>
								<td className='py-0.5 align-top'>Nomor Telpon Wali</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5 font-mono'>{s.telepon_wali || '-'}</td>
							</tr>
							<tr>
								<td className='py-0.5 align-top font-bold'>17.</td>
								<td className='py-0.5 align-top'>Pekerjaan Wali Peserta Didik</td>
								<td className='py-0.5 text-center align-top'>:</td>
								<td className='py-0.5'>{s.pekerjaan_wali || '-'}</td>
							</tr>
						</tbody>
					</table>
				</div>

				<div className='flex items-end justify-between px-8 mt-6'>
					<div
						className='border-2 border-black flex flex-col items-center justify-center text-center text-xs font-bold text-gray-500 bg-gray-50'
						style={{ width: '3cm', height: '4cm' }}>
						<span>Foto</span>
						<span>3 x 4 cm</span>
					</div>

					<div className='text-center' style={{ width: '260px' }}>
						<p className='text-[10pt] mb-1'>
							{tempatRaporDisplay}, {formatDateIndo(s.diterima_pada_tanggal) || tanggalRaporDisplay}
						</p>
						<p className='text-[10pt] font-semibold mb-12'>Kepala Sekolah,</p>
						<p className='text-[10.5pt] font-bold underline'>{sekolah.nama_kepsek || 'Mujib Kodar, S.Pd,I'}</p>
						<p className='text-[9.5pt]'>NIP. {sekolah.nip_kepsek || '-'}</p>
					</div>
				</div>
			</div>
		);
	};

	// 1. Header Identitas Siswa & Sekolah (Presisi Project Rapor)
	const renderStudentHeader = (bundle) => (
		<div className='student-info-header mb-4 text-[10pt] leading-tight text-black font-sans'>
			<div className='flex justify-between items-start'>
				{/* Kolom Kiri: 380px */}
				<table className='border-collapse' style={{ width: '380px' }}>
					<tbody>
						<tr>
							<td className='py-0.5 font-semibold align-top' style={{ width: '140px' }}>
								Nama Peserta Didik
							</td>
							<td className='py-0.5 text-center align-top' style={{ width: '20px' }}>
								:
							</td>
							<td className='py-0.5 font-bold uppercase align-top' style={{ width: '220px' }}>
								{bundle.siswa.nama_lengkap}
							</td>
						</tr>
						<tr>
							<td className='py-0.5 font-semibold align-top'>NIS / NISN</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>
								{bundle.siswa.nis || '-'} / {bundle.siswa.nisn || '-'}
							</td>
						</tr>
						<tr>
							<td className='py-0.5 font-semibold align-top'>Nama Sekolah</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>
								{sekolah.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH'}
							</td>
						</tr>
						<tr>
							<td className='py-0.5 font-semibold align-top'>Alamat Sekolah</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top leading-snug'>
								{sekolah.alamat || 'Kuala Gading'}
							</td>
						</tr>
					</tbody>
				</table>

				{/* Kolom Kanan: 280px */}
				<table className='border-collapse' style={{ width: '280px' }}>
					<tbody>
						<tr>
							<td className='py-0.5 font-semibold align-top' style={{ width: '110px' }}>
								Kelas
							</td>
							<td className='py-0.5 text-center align-top' style={{ width: '20px' }}>
								:
							</td>
							<td className='py-0.5 font-bold align-top' style={{ width: '150px' }}>
								{bundle.kelas.nama_kelas}
							</td>
						</tr>
						<tr>
							<td className='py-0.5 font-semibold align-top'>Fase</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>{bundle.kelas.fase || 'D'}</td>
						</tr>
						<tr>
							<td className='py-0.5 font-semibold align-top'>Semester</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>
								{bundleData?.semester_label || (semester === 1 ? '1 (Ganjil)' : '2 (Genap)')}
							</td>
						</tr>
						<tr>
							<td className='py-0.5 font-semibold align-top'>Tahun Pelajaran</td>
							<td className='py-0.5 text-center align-top'>:</td>
							<td className='py-0.5 align-top'>{tahunAjaran}</td>
						</tr>
					</tbody>
				</table>
			</div>
		</div>
	);

	// 2. Tabel Nilai Mata Pelajaran (Presisi Project Rapor: tinggi baris 111.2px)
	const renderGradeTable = (subjects) => {
		// Menghitung tinggi baris tabel agar mengisi halaman A4 secara proporsional (~667px untuk 6 mapel = 111.2px per baris)
		const count = Math.max(subjects.length, 1);
		const targetTotalHeight = 667;
		const calculatedHeight = Math.min(130, Math.max(111, Math.floor(targetTotalHeight / count)));
		const rowHeightStyle = { height: `${calculatedHeight}px` };

		return (
			<table
				className='w-full border-collapse border border-black text-[10pt] font-sans'
				style={{ tableLayout: 'fixed', marginBottom: '1.5rem' }}>
				<thead>
					<tr className='bg-gray-100 font-bold text-center text-black'>
						<th className='border border-black p-1 text-center' style={{ width: '40px' }}>
							No
						</th>
						<th className='border border-black p-1.5 text-center' style={{ width: '180px' }}>
							Mata Pelajaran
						</th>
						<th className='border border-black p-1 text-center' style={{ width: '60px' }}>
							Nilai<br />Akhir
						</th>
						<th className='border border-black p-1.5 text-center'>
							Capaian Kompetensi
						</th>
					</tr>
				</thead>
				<tbody>
					{subjects.map((m) => (
						<tr key={m.id || m.no} style={rowHeightStyle}>
							<td
								className='border border-black p-1 text-center align-middle font-bold'
								style={{ width: '40px' }}>
								{m.no}.
							</td>
							<td
								className='border border-black p-2 align-middle font-semibold leading-snug'
								style={{ width: '180px' }}>
								{m.nama}
							</td>
							<td
								className='border border-black p-1 text-center align-middle font-bold font-mono text-[10.5pt]'
								style={{ width: '60px' }}>
								{m.nilai !== undefined && m.nilai !== null ? m.nilai : '-'}
							</td>
							<td
								className={`border border-black align-middle text-justify ${getCapaianClass(m.capaian)}`}>
								{m.capaian || '-'}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		);
	};

	// 3. Area Tanda Tangan Wali Kelas (Hal 1 & Hal 2)
	const renderWaliSignature = (bundle) => (
		<div className='flex justify-end text-[10pt] font-sans mt-auto' style={{ paddingTop: '0.5rem' }}>
			<div className='text-center' style={{ width: '250px' }}>
				<p className='mb-0.5'>
					{tempatRaporDisplay}, {tanggalRaporDisplay}
				</p>
				<p className='font-semibold' style={{ marginBottom: '4.5rem' }}>
					Wali Kelas,
				</p>
				<p className='font-bold underline'>{bundle.kelas.wali_nama}</p>
				<p>NIP. {bundle.kelas.wali_nip || '-'}</p>
			</div>
		</div>
	);

	// 4. Halaman 3: Ekstrakurikuler, Ketidakhadiran, Catatan, & 3 Tanda Tangan
	const renderPage3 = (bundle) => {
		const ekskulList = bundle.ekstrakurikuler || [];
		const padCount = Math.max(0, 3 - ekskulList.length);
		const studentTingkat = getTingkatKelas(bundle.siswa?.kelas || bundle.kelas?.nama_kelas || '');

		return (
			<div className='flex flex-col justify-between h-full'>
				<div>
					{renderStudentHeader(bundle)}

					{/* Tabel Ekstrakurikuler */}
					<div style={{ marginBottom: '1.5rem' }}>
						<h4 className='font-bold mb-1 uppercase text-[10pt]'>Kegiatan Ekstrakurikuler</h4>
						<table
							className='w-full border-collapse border border-black text-[10pt]'
							style={{ tableLayout: 'fixed' }}>
							<thead>
								<tr className='bg-gray-100 font-bold text-center text-black'>
									<th className='border border-black p-1.5 text-center' style={{ width: '40px' }}>
										No
									</th>
									<th className='border border-black p-1.5 text-center' style={{ width: '220px' }}>
										Nama Kegiatan Ekstrakurikuler
									</th>
									<th className='border border-black p-1.5 text-center'>
										Predikat & Keterangan
									</th>
								</tr>
							</thead>
							<tbody>
								{ekskulList.length === 0 ? (
									<>
										<tr>
											<td className='border border-black p-1.5 text-center' style={{ width: '40px' }}>1.</td>
											<td className='border border-black p-1.5 font-semibold' style={{ width: '220px' }}>Praja Muda Karana (Pramuka)</td>
											<td className='border border-black p-1.5'>-</td>
										</tr>
										{studentTingkat === 9 ? (
											<>
												<tr>
													<td className='border border-black p-1.5 text-center'>2.</td>
													<td className='border border-black p-1.5 font-semibold'>Aswaja (Ke-NU-an)</td>
													<td className='border border-black p-1.5'>-</td>
												</tr>
												<tr>
													<td className='border border-black p-1.5 text-center'>3.</td>
													<td className='border border-black p-1.5 font-semibold'>Khot (Kaligrafi)</td>
													<td className='border border-black p-1.5'>-</td>
												</tr>
											</>
										) : (
											<>
												<tr>
													<td className='border border-black p-1.5 text-center'>2.</td>
													<td className='border border-black p-1.5 font-semibold'>Khot (Kaligrafi)</td>
													<td className='border border-black p-1.5'>-</td>
												</tr>
												<tr>
													<td className='border border-black p-1.5 text-center'>3.</td>
													<td className='border border-black p-1.5 font-semibold'>-</td>
													<td className='border border-black p-1.5'>-</td>
												</tr>
											</>
										)}
									</>
								) : (
									<>
										{ekskulList.map((e, idx) => (
											<tr key={idx}>
												<td className='border border-black p-1.5 text-center' style={{ width: '40px' }}>
													{idx + 1}.
												</td>
												<td className='border border-black p-1.5 font-semibold' style={{ width: '220px' }}>
													{e.nama_ekskul}
												</td>
												<td className='border border-black p-1.5'>
													{e.predikat && e.predikat !== '-' ? (
														<>
															<strong>{e.predikat}. </strong>
															{e.keterangan && e.keterangan !== '-' ? e.keterangan : ''}
														</>
													) : (
														<span>{e.keterangan && e.keterangan !== '-' ? e.keterangan : '-'}</span>
													)}
												</td>
											</tr>
										))}
										{Array.from({ length: padCount }).map((_, idx) => (
											<tr key={`empty-${idx}`}>
												<td className='border border-black p-1.5 text-center' style={{ width: '40px' }}>
													{ekskulList.length + idx + 1}.
												</td>
												<td className='border border-black p-1.5'>&nbsp;</td>
												<td className='border border-black p-1.5'>&nbsp;</td>
											</tr>
										))}
									</>
								)}
							</tbody>
						</table>
					</div>

					{/* Tabel Ketidakhadiran */}
					<div style={{ marginBottom: '1.5rem' }}>
						<h4 className='font-bold mb-1 uppercase text-[10pt]'>Ketidakhadiran</h4>
						<table
							className='border-collapse border border-black text-[10pt]'
							style={{ width: '250px' }}>
							<thead>
								<tr className='bg-gray-100 font-bold text-center text-black'>
									<th colSpan='3' className='border border-black p-1 text-center font-bold'>
										Ketidakhadiran
									</th>
								</tr>
							</thead>
							<tbody>
								<tr>
									<td className='border border-black p-1 font-semibold' style={{ width: '140px' }}>
										Sakit
									</td>
									<td className='border border-black p-1 text-center font-bold font-mono' style={{ width: '50px' }}>
										{bundle.ketidakhadiran?.sakit || 0}
									</td>
									<td className='border border-black p-1 text-center' style={{ width: '60px' }}>
										Hari
									</td>
								</tr>
								<tr>
									<td className='border border-black p-1 font-semibold'>Izin</td>
									<td className='border border-black p-1 text-center font-bold font-mono'>
										{bundle.ketidakhadiran?.izin || 0}
									</td>
									<td className='border border-black p-1 text-center'>Hari</td>
								</tr>
								<tr>
									<td className='border border-black p-1 font-semibold'>Tanpa Keterangan</td>
									<td className='border border-black p-1 text-center font-bold font-mono'>
										{bundle.ketidakhadiran?.tanpa_keterangan ?? bundle.ketidakhadiran?.alpa ?? 0}
									</td>
									<td className='border border-black p-1 text-center'>Hari</td>
								</tr>
							</tbody>
						</table>
					</div>

					{/* Catatan Wali Kelas */}
					<div style={{ marginBottom: '1.5rem' }}>
						<h4 className='font-bold mb-1 uppercase text-[10pt]'>Catatan Wali Kelas</h4>
						<div
							className='p-2.5 border border-black rounded text-[10pt] leading-relaxed'
							style={{ minHeight: '55px' }}>
							{bundle.ketidakhadiran?.catatan_wali_kelas ||
								'Tingkatkan terus ketekunan, ibadah, dan kedisiplinan dalam menuntut ilmu demi masa depan yang gemilang.'}
						</div>
					</div>
				</div>

				{/* Blok 3 Tanda Tangan Resmi (Orang Tua, Wali Kelas, Kepala Sekolah) */}
				<div className='pt-2 text-[10pt] font-sans'>
					<div className='flex justify-between items-start px-2' style={{ marginBottom: '1.5rem' }}>
						<div className='text-center' style={{ width: '250px' }}>
							<p className='font-semibold'>Mengetahui,</p>
							<p className='font-semibold mb-0.5'>Orang Tua / Wali,</p>
							<div style={{ height: '4.5rem' }} />
							<p className='border-b border-black w-44 mx-auto'></p>
						</div>
						<div className='text-center' style={{ width: '250px' }}>
							<p className='mb-0.5'>
								{tempatRaporDisplay}, {tanggalRaporDisplay}
							</p>
							<p className='font-semibold mb-0.5'>Wali Kelas,</p>
							<div style={{ height: '4.5rem' }} />
							<p className='font-bold underline'>{bundle.kelas.wali_nama}</p>
							<p>NIP. {bundle.kelas.wali_nip || '-'}</p>
						</div>
					</div>

					<div className='flex justify-center'>
						<div className='text-center' style={{ width: '280px' }}>
							<p className='font-semibold'>Mengetahui,</p>
							<p className='font-semibold mb-0.5'>Kepala SMP IT Tebuireng 4 Al-Ishlah,</p>
							<div style={{ height: '4.5rem' }} />
							<p className='font-bold underline'>{sekolah.nama_kepsek || 'Mujib Kodar, S.Pd,I'}</p>
							<p>NIP. {sekolah.nip_kepsek || '-'}</p>
						</div>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div className='space-y-6'>
			{/* CSS Khusus Print & Lembar Dokumen A4 */}
			<style
				dangerouslySetInnerHTML={{
					__html: `
						@media print {
							@page {
								size: A4 portrait;
								margin: 0;
							}
							html, body {
								margin: 0 !important;
								padding: 0 !important;
								background: #ffffff !important;
								color: #000000 !important;
								height: auto !important;
								min-height: auto !important;
								overflow: visible !important;
								display: block !important;
								-webkit-print-color-adjust: exact !important;
								print-color-adjust: exact !important;
							}
							.print\\:hidden,
							header,
							aside,
							nav {
								display: none !important;
							}
							#rapor-print-container {
								display: block !important;
								position: static !important;
								width: 100% !important;
								max-width: 100% !important;
								margin: 0 !important;
								padding: 0 !important;
								background: #ffffff !important;
							}
							.rapor-page {
								box-shadow: none !important;
								margin: 0 auto !important;
								border: none !important;
								border-radius: 0 !important;
								width: 210mm !important;
								height: 297mm !important;
								min-height: 297mm !important;
								max-height: 297mm !important;
								padding: 15mm 10mm !important;
								page-break-after: always !important;
								break-after: page !important;
								page-break-inside: avoid !important;
								box-sizing: border-box !important;
								overflow: hidden !important;
							}
							.rapor-page:last-child {
								page-break-after: auto !important;
								break-after: auto !important;
							}
							::-webkit-scrollbar {
								display: none !important;
							}
						}
					`,
				}}
			/>

			{/* Header Navigasi / Kontrol Cetak */}
			<div className='print:hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]'>
				<div className='space-y-1'>
					<h2 className='text-xl sm:text-2xl font-black text-black flex items-center gap-2'>
						<Printer className='w-6 h-6 text-black' />
						<span>Cetak Lembar Rapor Digital</span>
					</h2>
					<p className='text-xs sm:text-sm font-medium text-gray-600'>
						Format standar Kurikulum Merdeka Fase D (SMP IT Tebuireng 4 Al-Ishlah) — Ukuran A4 Portrait.
					</p>
				</div>
				<button
					onClick={() => window.print()}
					disabled={loading || displayedBundles.length === 0}
					className='px-5 py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black text-xs sm:text-sm rounded-xl border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer'>
					<Printer className='w-4 h-4' />
					<span>
						{selectedSiswaId === 'ALL'
							? `Cetak Seluruh Siswa (${displayedBundles.length} Siswa)`
							: activeSheet === 'semua'
							? 'Cetak Buku Rapor Lengkap (A4)'
							: activeSheet === 'cover'
							? 'Cetak Cover Depan (A4)'
							: activeSheet === 'sekolah'
							? 'Cetak Data Sekolah (A4)'
							: activeSheet === 'biodata'
							? 'Cetak Biodata Siswa (A4)'
							: activeSheet === 'semester'
							? 'Cetak Nilai Semester (A4)'
							: activeSheet === 'nilai1'
							? 'Cetak Lembar 1 (A4)'
							: activeSheet === 'nilai2'
							? 'Cetak Lembar 2 (A4)'
							: 'Cetak Lembar 3 (A4)'}
					</span>
				</button>
			</div>

			{loading ? (
				<div className='p-16 text-center bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] space-y-4'>
					<Loader />
					<p className='text-sm font-black text-black'>Memuat lembar cetak rapor digital...</p>
					<p className='text-xs font-bold text-gray-500'>
						Mengkalkulasi nilai, presensi, ekstrakurikuler, dan tata letak dokumen A4
					</p>
				</div>
			) : (
				<>
					{/* Toolbar Filter Siswa & Navigasi Lembar */}
					<div className='print:hidden p-4 sm:p-5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-wrap gap-4 items-center justify-between'>
						<div className='flex flex-wrap items-center gap-3 w-full sm:w-auto'>
							<div className='flex items-center gap-2'>
								<span className='text-xs font-black uppercase text-gray-600'>Kelas Binaan:</span>
								{kelasList.length > 1 ? (
									<select
										value={selectedKelasId}
										onChange={(e) => {
											const newId = e.target.value;
											setSelectedKelasId(newId);
											setSelectedSiswaId('');
											const targetK = kelasList.find((k) => String(k.id) === String(newId));
											if (targetK) {
												const defaultTab = getDefaultSheetByKelas(targetK.nama_kelas || targetK.kelas);
												setActiveSheet(defaultTab);
											}
										}}
										className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold cursor-pointer'>
										{kelasList.map((k) => (
											<option key={k.id} value={k.id}>
												{k.nama_kelas}
											</option>
										))}
									</select>
								) : kelasList.length === 1 ? (
									<span className='px-3.5 py-1 bg-yellow-300 text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000]'>
										{kelasList[0].nama_kelas}
									</span>
								) : (
									<span className='px-3 py-1 bg-rose-100 text-rose-700 border-2 border-rose-400 rounded-xl text-xs font-bold'>
										Bukan Wali Kelas
									</span>
								)}
							</div>

							<div className='flex items-center gap-2'>
								<span className='text-xs font-black uppercase text-gray-600'>Siswa:</span>
								<select
									value={selectedSiswaId}
									onChange={(e) => setSelectedSiswaId(e.target.value)}
									className='px-3 py-1.5 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold max-w-xs cursor-pointer'>
									<option value='ALL'>📋 Cetak Seluruh Siswa Rombel ({students.length} Siswa)</option>
									{students.map((s) => (
										<option key={s.siswa.id} value={s.siswa.id}>
											{s.siswa.nama_lengkap} ({s.siswa.nis || s.siswa.nisn || '-'})
										</option>
									))}
								</select>
							</div>

							<span className='px-2.5 py-1 bg-gray-100 text-black border border-black rounded-lg text-xs font-black'>
								Semester {semester} • {tahunAjaran}
							</span>
						</div>

						{/* Tab Navigasi Lembar Halaman */}
						<div className='flex items-center gap-1.5 bg-gray-100 p-1.5 border-2 border-black rounded-xl flex-wrap'>
							<button
								type='button'
								onClick={() => setActiveSheet('semua')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
									activeSheet === 'semua'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								<span>Buku Lengkap</span>
								{currentTingkat === 7 && (
									<span
										className={`text-[9.5px] px-1.5 py-0.5 rounded font-black uppercase ${
											activeSheet === 'semua' ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-700'
										}`}>
										Default
									</span>
								)}
							</button>
							<button
								type='button'
								onClick={() => setActiveSheet('cover')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
									activeSheet === 'cover'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								Cover
							</button>
							<button
								type='button'
								onClick={() => setActiveSheet('sekolah')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
									activeSheet === 'sekolah'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								Data Sekolah
							</button>
							<button
								type='button'
								onClick={() => setActiveSheet('biodata')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
									activeSheet === 'biodata'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								Biodata Siswa
							</button>
							<button
								type='button'
								onClick={() => setActiveSheet('semester')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
									activeSheet === 'semester'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								<span>Nilai Semester</span>
								{(currentTingkat === 8 || currentTingkat === 9) && (
									<span
										className={`text-[9.5px] px-1.5 py-0.5 rounded font-black uppercase ${
											activeSheet === 'semester' ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-700'
										}`}>
										Default
									</span>
								)}
							</button>
							<button
								type='button'
								onClick={() => setActiveSheet('nilai1')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
									activeSheet === 'nilai1'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								Lembar 1 (Nilai 1-6)
							</button>
							<button
								type='button'
								onClick={() => setActiveSheet('nilai2')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
									activeSheet === 'nilai2'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								Lembar 2 (Nilai 7+)
							</button>
							<button
								type='button'
								onClick={() => setActiveSheet('ekskul')}
								className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
									activeSheet === 'ekskul'
										? 'bg-black text-white shadow-[1px_1px_0px_#000]'
										: 'text-gray-700 hover:bg-white'
								}`}>
								Lembar 3 (Ekskul)
							</button>
						</div>
					</div>

					{/* Status Titimangsa & Kontrol Dinamis (Safeguard) */}
					<div className='print:hidden p-3.5 sm:p-4 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3'>
						<div className='flex items-center gap-2.5 flex-wrap'>
							<div className='flex items-center gap-1.5 px-3 py-1 bg-gray-50 border-2 border-black rounded-xl text-xs font-bold shadow-[1.5px_1.5px_0px_#000]'>
								<MapPin className='w-3.5 h-3.5 text-black shrink-0' />
								<span>
									Titimangsa: <strong>{tempatRaporDisplay}</strong>, <strong>{tanggalRaporDisplay || '-'}</strong>
								</span>
							</div>

							{isOfficialDate ? (
								<span className='px-2.5 py-1 bg-emerald-100 text-emerald-900 border-2 border-emerald-500 rounded-xl text-[11px] font-black uppercase flex items-center gap-1 shadow-[1.5px_1.5px_0px_#059669]'>
									<Check className='w-3 h-3 text-emerald-700' />
									<span>Resmi Disahkan Kurikulum</span>
								</span>
							) : (
								<span className='px-2.5 py-1 bg-amber-100 text-amber-900 border-2 border-amber-500 rounded-xl text-[11px] font-black uppercase flex items-center gap-1 shadow-[1.5px_1.5px_0px_#D97706]' title='Tanggal ini dihitung otomatis dari kalender tahun ajar karena belum disahkan resmi di menu Manajemen Rapor Kurikulum.'>
									<AlertTriangle className='w-3 h-3 text-amber-700' />
									<span>Estimasi Kalender Otomatis</span>
								</span>
							)}

							{customTanggalRapor && (
								<span className='px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-400 rounded-lg text-[10px] font-bold'>
									(Disesuaikan Sesi Ini)
								</span>
							)}
						</div>

						{/* Kontrol Cepat Ubah Tanggal Sesi Cetak */}
						<div className='flex items-center gap-2 w-full sm:w-auto'>
							{isEditingTitimangsa ? (
								<div className='flex items-center gap-2 flex-wrap w-full sm:w-auto'>
									<input
										type='text'
										value={customTempatRapor !== '' ? customTempatRapor : tempatRaporDisplay}
										onChange={(e) => setCustomTempatRapor(e.target.value)}
										placeholder='Kota / Desa'
										className='px-2.5 py-1 bg-gray-50 border-2 border-black rounded-lg text-xs font-bold w-28'
									/>
									<input
										type='text'
										value={customTanggalRapor !== '' ? customTanggalRapor : tanggalRaporDisplay}
										onChange={(e) => setCustomTanggalRapor(e.target.value)}
										placeholder='Contoh: 20 Desember 2026'
										className='px-2.5 py-1 bg-gray-50 border-2 border-black rounded-lg text-xs font-bold w-44'
									/>
									<button
										type='button'
										onClick={() => setIsEditingTitimangsa(false)}
										className='px-2.5 py-1 bg-black text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-gray-800 transition-colors'>
										Simpan Sesi
									</button>
									<button
										type='button'
										onClick={() => {
											setCustomTanggalRapor('');
											setCustomTempatRapor('');
											setIsEditingTitimangsa(false);
										}}
										className='px-2 py-1 text-gray-600 hover:text-black text-xs font-bold cursor-pointer'
										title='Reset ke tanggal sistem'>
										<RotateCcw className='w-3.5 h-3.5' />
									</button>
								</div>
							) : (
								<button
									type='button'
									onClick={() => setIsEditingTitimangsa(true)}
									className='px-3 py-1 bg-gray-100 hover:bg-gray-200 text-black border border-black rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer'>
									<Edit2 className='w-3 h-3' />
									<span>Sesuaikan Titimangsa</span>
								</button>
							)}
						</div>
					</div>

					{!isOfficialDate && (
						<div className='print:hidden px-4 py-2.5 bg-amber-50 border-2 border-amber-400 rounded-2xl text-xs font-medium text-amber-900 flex items-center justify-between gap-2 shadow-[2px_2px_0px_#F59E0B]'>
							<div className='flex items-center gap-2'>
								<AlertTriangle className='w-4 h-4 text-amber-600 shrink-0' />
								<span>
									<strong>Perhatian:</strong> Tanggal rapor <strong>{tanggalRaporDisplay}</strong> dihitung secara otomatis berdasarkan kalender tahun ajar semester ini ({bundleData?.semester_label || semester}) karena Waka Kurikulum belum mengesahkan tanggal resmi di menu Manajemen Rapor.
								</span>
							</div>
						</div>
					)}

					{/* Container Lembar Kertas Rapor (Format Cetak A4) */}
					{kelasList.length === 0 ? (
						<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
							<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
							<h3 className='text-base font-black text-black'>Bukan Wali Kelas</h3>
							<p className='text-xs text-gray-500'>
								Akun Anda tidak tercatat sebagai Wali Kelas pada periode ini. Cetak rapor siswa hanya dapat
								diakses oleh Wali Kelas binaan atau Administrator.
							</p>
						</div>
					) : displayedBundles.length === 0 ? (
						<div className='p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] text-center space-y-2'>
							<AlertCircle className='w-8 h-8 mx-auto text-amber-500' />
							<h3 className='text-base font-black text-black'>Data Siswa Belum Dipilih</h3>
						</div>
					) : (
						<div id='rapor-print-container' className='space-y-8 flex flex-col items-center w-full'>
							{displayedBundles.map((bundle, bIdx) => {
								const allScores = bundle?.mapel_scores || [];
								const mapelPage1 = allScores.slice(0, 6);
								const mapelPage2 = allScores.slice(6);
								const hasPage2 = mapelPage2.length > 0;

								const showCover = activeSheet === 'semua' || activeSheet === 'cover';
								const showSekolah = activeSheet === 'semua' || activeSheet === 'sekolah';
								const showBiodata = activeSheet === 'semua' || activeSheet === 'biodata';
								const showNilai1 = activeSheet === 'semua' || activeSheet === 'semester' || activeSheet === 'nilai1';
								const showNilai2 = hasPage2 && (activeSheet === 'semua' || activeSheet === 'semester' || activeSheet === 'nilai2');
								const showEkskul = activeSheet === 'semua' || activeSheet === 'semester' || activeSheet === 'ekskul';

								return (
									<div
										key={bundle.siswa.id || bIdx}
										className='space-y-8 flex flex-col items-center w-full'>
										{/* ============================================================== */}
										{/* COVER RAPOR (Ukuran 210mm x 297mm A4)                          */}
										{/* ============================================================== */}
										{showCover && renderCoverPage(bundle)}

										{showCover && (showSekolah || showBiodata || showNilai1) && (
											<div className='w-full border-b-2 border-dashed border-gray-400 print:hidden my-2 text-center text-xs text-gray-500 font-bold'>
												--- Garis Batas Halaman Cetak A4 (Cover Rapor selesai) ---
											</div>
										)}

										{/* ============================================================== */}
										{/* DATA SEKOLAH (IDENTITAS SATUAN PENDIDIKAN)                      */}
										{/* ============================================================== */}
										{showSekolah && renderSchoolIdentityPage()}

										{showSekolah && (showBiodata || showNilai1) && (
											<div className='w-full border-b-2 border-dashed border-gray-400 print:hidden my-2 text-center text-xs text-gray-500 font-bold'>
												--- Garis Batas Halaman Cetak A4 (Data Sekolah selesai) ---
											</div>
										)}

										{/* ============================================================== */}
										{/* BIODATA SISWA (IDENTITAS PESERTA DIDIK)                        */}
										{/* ============================================================== */}
										{showBiodata && renderStudentBiodataPage(bundle)}

										{showBiodata && showNilai1 && (
											<div className='w-full border-b-2 border-dashed border-gray-400 print:hidden my-2 text-center text-xs text-gray-500 font-bold'>
												--- Garis Batas Halaman Cetak A4 (Biodata Siswa selesai) ---
											</div>
										)}

										{/* ============================================================== */}
										{/* LEMBAR 1: MATA PELAJARAN 1-6 (Ukuran 210mm x 297mm A4)          */}
										{/* ============================================================== */}
										{showNilai1 && (
											<div
												className='rapor-page bg-white mx-auto border-4 border-[#0a0a0a] rounded-2xl shadow-[12px_12px_0px_0px_#0a0a0a] transition-all flex flex-col justify-between'
												style={{
													width: '210mm',
													height: '297mm',
													minHeight: '297mm',
													maxHeight: '297mm',
													padding: '15mm 10mm',
													boxSizing: 'border-box',
													fontFamily: 'Arial, Helvetica, sans-serif',
													fontSize: '10.5pt',
													color: 'black',
													position: 'relative',
												}}>
												<div>
													{renderStudentHeader(bundle)}
													{renderGradeTable(mapelPage1)}
												</div>
												{renderWaliSignature(bundle)}
											</div>
										)}

										{/* Pembatas Halaman di UI Preview */}
										{(showNilai1 && (showNilai2 || showEkskul)) && (
											<div className='w-full border-b-2 border-dashed border-gray-400 print:hidden my-2 text-center text-xs text-gray-500 font-bold'>
												--- Garis Batas Halaman Cetak A4 (Lembar 1 selesai) ---
											</div>
										)}

										{/* ============================================================== */}
										{/* LEMBAR 2: MATA PELAJARAN 7+ (Jika Ada)                          */}
										{/* ============================================================== */}
										{showNilai2 && (
											<div
												className='rapor-page bg-white mx-auto border-4 border-[#0a0a0a] rounded-2xl shadow-[12px_12px_0px_0px_#0a0a0a] transition-all flex flex-col justify-between'
												style={{
													width: '210mm',
													height: '297mm',
													minHeight: '297mm',
													maxHeight: '297mm',
													padding: '15mm 10mm',
													boxSizing: 'border-box',
													fontFamily: 'Arial, Helvetica, sans-serif',
													fontSize: '10.5pt',
													color: 'black',
													position: 'relative',
												}}>
												<div>
													{renderStudentHeader(bundle)}
													{renderGradeTable(mapelPage2)}
												</div>
												{renderWaliSignature(bundle)}
											</div>
										)}

										{/* Pembatas Halaman di UI Preview */}
										{(showNilai2 && showEkskul) && (
											<div className='w-full border-b-2 border-dashed border-gray-400 print:hidden my-2 text-center text-xs text-gray-500 font-bold'>
												--- Garis Batas Halaman Cetak A4 (Lembar 2 selesai) ---
											</div>
										)}

										{/* ============================================================== */}
										{/* LEMBAR 3: EKSTRAKURIKULER, PRESENSI, CATATAN, TANDA TANGAN     */}
										{/* ============================================================== */}
										{showEkskul && (
											<div
												className='rapor-page bg-white mx-auto border-4 border-[#0a0a0a] rounded-2xl shadow-[12px_12px_0px_0px_#0a0a0a] transition-all'
												style={{
													width: '210mm',
													height: '297mm',
													minHeight: '297mm',
													maxHeight: '297mm',
													padding: '15mm 10mm',
													boxSizing: 'border-box',
													fontFamily: 'Arial, Helvetica, sans-serif',
													fontSize: '10.5pt',
													color: 'black',
													position: 'relative',
												}}>
												{renderPage3(bundle)}
											</div>
										)}

										{/* Batas Antar-Siswa saat Mode Cetak Seluruh Siswa Rombel */}
										{selectedSiswaId === 'ALL' && bIdx < displayedBundles.length - 1 && (
											<div className='w-full border-b-4 border-dashed border-black print:hidden my-8 text-center text-xs font-black bg-yellow-100 p-2.5 rounded-xl shadow-[2px_2px_0px_#000]'>
												--- Selesai Rapor: {bundle.siswa.nama_lengkap} | Lanjut ke Siswa Berikutnya: {displayedBundles[bIdx + 1]?.siswa?.nama_lengkap} ---
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</>
			)}
		</div>
	);
}
