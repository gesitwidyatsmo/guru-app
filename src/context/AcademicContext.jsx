'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AcademicContext = createContext(null);

const STORAGE_KEY = 'guruapp_academic_period';

export function AcademicProvider({ children }) {
	// Periode yang sedang DILIHAT user
	const [tahunAjar, setTahunAjarState] = useState('2026/2027');
	const [semester, setSemesterState] = useState(1);

	// Periode yang AKTIF di sistem (dari DB)
	const [tahunAjarAktif, setTahunAjarAktif] = useState('2026/2027');
	const [semesterAktif, setSemesterAktif] = useState(1);

	// List semua periode
	const [daftarTahunAjar, setDaftarTahunAjar] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	// Apakah sedang melihat periode aktif
	const isViewingActive = tahunAjar === tahunAjarAktif && semester === semesterAktif;

	// Load data awal
	const loadAcademicData = useCallback(async () => {
		try {
			setIsLoading(true);

			// Fetch periode aktif + list semua periode secara paralel
			const [resAktif, resList] = await Promise.all([
				fetch('/api/tahun-ajar/aktif'),
				fetch('/api/tahun-ajar'),
			]);

			if (resAktif.ok) {
				const aktif = await resAktif.json();
				setTahunAjarAktif(aktif.nama);
				setSemesterAktif(Number(aktif.semester));

				// Cek apakah ada saved preference di localStorage
				const saved = localStorage.getItem(STORAGE_KEY);
				if (saved) {
					try {
						const parsed = JSON.parse(saved);
						// Validasi bahwa saved period masih valid
						setTahunAjarState(parsed.tahunAjar || aktif.nama);
						setSemesterState(Number(parsed.semester) || Number(aktif.semester));
					} catch {
						// Fallback ke aktif
						setTahunAjarState(aktif.nama);
						setSemesterState(Number(aktif.semester));
					}
				} else {
					// Default: tampilkan periode aktif
					setTahunAjarState(aktif.nama);
					setSemesterState(Number(aktif.semester));
				}
			}

			if (resList.ok) {
				const list = await resList.json();
				setDaftarTahunAjar(list);
			}
		} catch (err) {
			console.error('AcademicContext: Gagal load data:', err);
			// Fallback hardcoded
			setTahunAjarAktif('2026/2027');
			setSemesterAktif(1);
			setTahunAjarState('2026/2027');
			setSemesterState(1);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		loadAcademicData();
	}, [loadAcademicData]);

	// Setter yang sekaligus simpan ke localStorage
	const setTahunAjar = useCallback((val) => {
		setTahunAjarState(val);
		const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, tahunAjar: val }));
	}, []);

	const setSemester = useCallback((val) => {
		setSemesterState(val);
		const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, semester: val }));
	}, []);

	// Helper: set sekaligus (tahunAjar + semester bersamaan)
	const setPeriode = useCallback((newTahunAjar, newSemester) => {
		const sem = Number(newSemester);
		setTahunAjarState(newTahunAjar);
		setSemesterState(sem);
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ tahunAjar: newTahunAjar, semester: sem }));
	}, []);

	// Helper: reset ke periode aktif
	const resetKeAktif = useCallback(() => {
		setPeriode(tahunAjarAktif, semesterAktif);
	}, [tahunAjarAktif, semesterAktif, setPeriode]);

	// Helper: build query string untuk fetch
	const buildPeriodeQuery = useCallback(() => {
		return `tahun_ajar=${encodeURIComponent(tahunAjar)}&semester=${semester}`;
	}, [tahunAjar, semester]);

	// Refresh daftar tahun ajar (dipanggil setelah Admin buat baru)
	const refreshDaftar = useCallback(async () => {
		try {
			const [resAktif, resList] = await Promise.all([
				fetch('/api/tahun-ajar/aktif'),
				fetch('/api/tahun-ajar'),
			]);
			if (resAktif.ok) {
				const aktif = await resAktif.json();
				setTahunAjarAktif(aktif.nama);
				setSemesterAktif(Number(aktif.semester));
			}
			if (resList.ok) {
				const list = await resList.json();
				setDaftarTahunAjar(list);
			}
		} catch (err) {
			console.error('refreshDaftar error:', err);
		}
	}, []);

	const value = {
		// Periode yang sedang dilihat
		tahunAjar,
		semester,
		setTahunAjar,
		setSemester,
		setPeriode,
		resetKeAktif,
		buildPeriodeQuery,

		// Periode aktif di sistem
		tahunAjarAktif,
		semesterAktif,
		isViewingActive,

		// List semua periode
		daftarTahunAjar,
		refreshDaftar,

		// Loading state
		isLoading,
	};

	return (
		<AcademicContext.Provider value={value}>
			{children}
		</AcademicContext.Provider>
	);
}

// Hook untuk dipakai di semua halaman
export function useAcademic() {
	const ctx = useContext(AcademicContext);
	if (!ctx) {
		throw new Error('useAcademic harus dipakai di dalam AcademicProvider');
	}
	return ctx;
}
