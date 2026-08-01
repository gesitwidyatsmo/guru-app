"use client";
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Dices, HelpCircle, UserCheck, MessageSquare, Play, Settings, Trophy, Users, CheckSquare, Square, RefreshCw, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function DashboardArisan() {
	const router = useRouter();
	
	// State Data
	const [kelasList, setKelasList] = useState([]);
	const [siswaList, setSiswaList] = useState([]);
	
	// State Selections
	const [selectedKelas, setSelectedKelas] = useState('');
	const [targetMode, setTargetMode] = useState('individu');
	const [jumlahKelompokStr, setJumlahKelompokStr] = useState('4');
	const [selectedSiswaIds, setSelectedSiswaIds] = useState([]);
	const [generatedGroupsList, setGeneratedGroupsList] = useState([]);
	
	// State UI/Loading
	const [loadingKelas, setLoadingKelas] = useState(true);
	const [loadingSiswa, setLoadingSiswa] = useState(false);
	const [showPesertaModal, setShowPesertaModal] = useState(false);
	const [showGroupSelectModal, setShowGroupSelectModal] = useState(false);
	const [selectedGameRoute, setSelectedGameRoute] = useState('');
	const [arisanScores, setArisanScores] = useState({});

	// Fetch Kelas on Mount
	useEffect(() => {
		// Load scores from sessionStorage
		const storedScores = sessionStorage.getItem('arisan_scores');
		if (storedScores) {
			setArisanScores(JSON.parse(storedScores));
		}
		const fetchKelas = async () => {
			setLoadingKelas(true);
			try {
				const res = await fetch('/api/kelas');
				if (res.ok) {
					const data = await res.json();
					setKelasList(data);
					if (data.length > 0) {
						setSelectedKelas(data[0].kelas);
					}
				}
			} catch (error) {
				console.error("Error fetching kelas:", error);
			} finally {
				setLoadingKelas(false);
			}
		};
		fetchKelas();
	}, []);

	// Fetch Siswa when selectedKelas changes
	useEffect(() => {
		if (!selectedKelas) return;
		
		const fetchSiswa = async () => {
			setLoadingSiswa(true);
			try {
				const res = await fetch(`/api/siswa?kelas=${selectedKelas}`);
				if (res.ok) {
					const data = await res.json();
					const activeSiswa = data.filter(s => s.status !== 'Alumni');
					setSiswaList(activeSiswa);
					setSelectedSiswaIds(activeSiswa.map(s => s.id));
				}
			} catch (error) {
				console.error("Error fetching siswa:", error);
			} finally {
				setLoadingSiswa(false);
			}
		};
		fetchSiswa();
	}, [selectedKelas]);

	const toggleSiswa = (id) => {
		setSelectedSiswaIds(prev => 
			prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
		);
	};

	const selectAll = () => setSelectedSiswaIds(siswaList.map(s => s.id));
	const deselectAll = () => setSelectedSiswaIds([]);

	const generateGroups = () => {
		let num = parseInt(jumlahKelompokStr);
		if (isNaN(num) || num < 2) num = 2; // Default fallback if invalid
		if (num > selectedSiswaIds.length) num = selectedSiswaIds.length;

		const activePeserta = siswaList.filter(s => selectedSiswaIds.includes(s.id));
		let shuffled = [...activePeserta].sort(() => 0.5 - Math.random());
		let groups = Array.from({ length: num }, () => []);
		
		shuffled.forEach((siswa, index) => {
			groups[index % num].push(siswa);
		});
		
		groups = groups.filter(g => g.length > 0);
		const formattedGroups = groups.map((g, i) => ({
			nama_tim: `Tim ${i + 1}`,
			anggota: g
		}));

		setGeneratedGroupsList(formattedGroups);
		return formattedGroups;
	};

	// Auto generate groups if mode is kelompok and relevant states change
	useEffect(() => {
		if (targetMode === 'kelompok') {
			generateGroups();
		} else {
			setGeneratedGroupsList([]);
		}
	}, [targetMode, jumlahKelompokStr, selectedSiswaIds]); // Re-run when these change

	const handlePlayClick = (gameRoute) => {
		if (selectedSiswaIds.length === 0) {
			alert("Pilih minimal 1 peserta terlebih dahulu!");
			setShowPesertaModal(true);
			return;
		}

		let gameData = {
			kelas: selectedKelas,
			mode: targetMode,
			peserta: [] 
		};

		if (targetMode === 'kelompok') {
			// Pass the groups we already generated
			gameData.peserta = generatedGroupsList.length > 0 ? generatedGroupsList : generateGroups();
			sessionStorage.setItem('arisan_game_data', JSON.stringify(gameData));
			
			// Show group selection modal instead of direct navigation
			setSelectedGameRoute(gameRoute);
			setShowGroupSelectModal(true);
			return;
		}

		sessionStorage.setItem('arisan_game_data', JSON.stringify(gameData));
		router.push(gameRoute);
	};

	const handleStartGroupGame = (timName) => {
		setShowGroupSelectModal(false);
		router.push(`${selectedGameRoute}?tim=${encodeURIComponent(timName)}`);
	};

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] p-6 md:p-12 font-sans'>
			
			{/* Header */}
			<div className='w-full max-w-6xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6'>
				<div className='flex items-center gap-4'>
					<Link href="/game">
						<button className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
							<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
						</button>
					</Link>
					<div className='bg-[#FF90E8] p-3 border-[4px] border-[#0D0D0D] -rotate-1 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
						<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>ARISAN DASHBOARD</h1>
					</div>
				</div>

				{/* Quick Settings Bar */}
				<div className='bg-white p-3 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] flex flex-wrap items-center gap-4 w-full lg:w-auto z-10'>
					
					{/* Kelas Selector */}
					<div className='flex items-center gap-2'>
						<div className='flex items-center gap-1 font-bold'>
							<Settings size={20} /> 
							<span className='hidden sm:inline'>Kelas:</span>
						</div>
						{loadingKelas ? (
							<div className='bg-gray-200 border-[3px] border-[#0D0D0D] p-1.5 w-24 animate-pulse'></div>
						) : (
							<select 
								value={selectedKelas}
								onChange={(e) => setSelectedKelas(e.target.value)}
								className='bg-[#F5C518] border-[3px] border-[#0D0D0D] p-1.5 font-bold outline-none cursor-pointer text-sm'>
								{kelasList.map(k => (
									<option key={k.id} value={k.kelas}>{k.kelas}</option>
								))}
							</select>
						)}
					</div>

					<div className='hidden sm:block w-0.5 h-8 bg-[#0D0D0D]'></div>

					{/* Target Selector */}
					<div className='flex items-center gap-2'>
						<div className='flex items-center gap-1 font-bold'>
							<Users size={20} />
							<span className='hidden sm:inline'>Target:</span>
						</div>
						<select 
							value={targetMode}
							onChange={(e) => setTargetMode(e.target.value)}
							className='bg-[#FF90E8] border-[3px] border-[#0D0D0D] p-1.5 font-bold outline-none cursor-pointer text-sm'>
							<option value="individu">Individu (Siswa)</option>
							<option value="kelompok">Kelompok (Tim)</option>
						</select>
					</div>

					{/* Jumlah Kelompok Input (Only if mode = kelompok) */}
					{targetMode === 'kelompok' && (
						<>
							<div className='hidden sm:block w-0.5 h-8 bg-[#0D0D0D]'></div>
							<div className='flex items-center gap-2'>
								<span className='font-bold text-sm'>Jumlah Tim:</span>
								<input 
									type="number" 
									min="2" max="10"
									value={jumlahKelompokStr}
									onChange={(e) => setJumlahKelompokStr(e.target.value)}
									className='w-16 bg-[#A3E635] border-[3px] border-[#0D0D0D] p-1 font-bold text-center outline-none'
								/>
							</div>
						</>
					)}

					<div className='hidden sm:block w-0.5 h-8 bg-[#0D0D0D]'></div>

					{/* Atur Peserta Button */}
					<button 
						onClick={() => setShowPesertaModal(true)}
						className='bg-[#2F80ED] text-white px-3 py-1.5 border-[3px] border-[#0D0D0D] font-bold text-sm hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_0px_#0D0D0D] transition-all flex items-center gap-1'>
						<UserCheck size={16} />
						Atur Peserta ({selectedSiswaIds.length}/{siswaList.length})
					</button>

				</div>
			</div>

			<div className='max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8'>
				
				{/* Main Game Selection (Takes up 2 columns) */}
				<div className='lg:col-span-2 space-y-8'>
					<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] inline-block shadow-[4px_4px_0px_0px_#0D0D0D] mb-2'>
						<h2 className='text-xl md:text-2xl font-black uppercase tracking-wider'>Pilih Mode Permainan</h2>
					</div>
					
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-6'>
						
						{/* Game 1: Tebak Gambar (NEW) */}
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 relative group overflow-hidden flex flex-col h-full'>
							<div className='absolute -top-2 -right-12 bg-[#FF4545] text-white font-black text-xs md:text-sm uppercase px-12 py-2 rotate-45 border-b-[4px] border-[#0D0D0D] z-10 shadow-sm'>
								BARU
							</div>
							<div className='bg-[#FF90E8] w-16 h-16 flex items-center justify-center border-[3px] border-[#0D0D0D] mb-4 group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_0px_#0D0D0D] shrink-0'>
								<UserCheck size={32} strokeWidth={2.5} />
							</div>
							<h3 className='text-2xl font-black mb-2 uppercase'>Tebak Gambar</h3>
							<p className='font-medium border-l-[3px] border-[#2F80ED] pl-3 mb-6 flex-grow'>
								1 Murid menebak, sisanya memberi clue dari gambar di layar. Uji wawasan dan kekompakan!
							</p>
							<button 
								onClick={() => handlePlayClick('/game/arisan/tebak-gambar')}
								className='w-full bg-[#A3E635] py-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:translate-y-1 hover:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2 font-black uppercase'>
								<Play size={20} fill="currentColor" /> Mainkan
							</button>
						</div>

						{/* Game 2: Eja Kata (NEW) */}
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 relative group flex flex-col h-full'>
							<div className='absolute -top-2 -right-12 bg-[#FF4545] text-white font-black text-xs md:text-sm uppercase px-12 py-2 rotate-45 border-b-[4px] border-[#0D0D0D] z-10 shadow-sm'>
								BARU
							</div>
							<div className='bg-[#2F80ED] text-white w-16 h-16 flex items-center justify-center border-[3px] border-[#0D0D0D] mb-4 group-hover:-rotate-12 transition-transform shadow-[4px_4px_0px_0px_#0D0D0D] shrink-0'>
								<MessageSquare size={32} strokeWidth={2.5} />
							</div>
							<h3 className='text-2xl font-black mb-2 uppercase'>Eja Kata</h3>
							<p className='font-medium border-l-[3px] border-[#FF90E8] pl-3 mb-6 flex-grow'>
								Mode Kelompok: Tiap anggota eja 1 huruf secara bergiliran dalam 60 detik. Seru dan menegangkan!
							</p>
							<button 
								onClick={() => handlePlayClick('/game/arisan/eja-kata')}
								className='w-full bg-[#F5C518] py-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:translate-y-1 hover:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2 font-black uppercase'>
								<Play size={20} fill="currentColor" /> Mainkan
							</button>
						</div>

						{/* Game 3: Iya Iya Engga Engga (NEW) */}
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 relative group flex flex-col h-full'>
							<div className='absolute -top-2 -right-12 bg-[#FF4545] text-white font-black text-xs md:text-sm uppercase px-12 py-2 rotate-45 border-b-[4px] border-[#0D0D0D] z-10 shadow-sm'>
								BARU
							</div>
							<div className='bg-[#F5C518] text-black w-16 h-16 flex items-center justify-center border-[3px] border-[#0D0D0D] mb-4 group-hover:rotate-12 transition-transform shadow-[4px_4px_0px_0px_#0D0D0D] shrink-0'>
								<HelpCircle size={32} strokeWidth={2.5} />
							</div>
							<h3 className='text-2xl font-black mb-2 uppercase'>Iya Iya Engga Engga</h3>
							<p className='font-medium border-l-[3px] border-[#FF4545] pl-3 mb-6 flex-grow'>
								1 Murid tanya ciri-ciri gambar ke audiens. Audiens cuma boleh jawab IYA/ENGGA/BISA JADI!
							</p>
							<button 
								onClick={() => handlePlayClick('/game/arisan/iya-engga')}
								className='w-full bg-[#FF90E8] py-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:translate-y-1 hover:shadow-none active:translate-y-1 transition-all flex items-center justify-center gap-2 font-black uppercase text-black'>
								<Play size={20} fill="currentColor" /> Mainkan
							</button>
						</div>

						{/* Game 4: Roda Keberuntungan (OLD -> SOON) */}
						<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 relative group opacity-80 flex flex-col h-full'>
							<div className='bg-gray-300 w-16 h-16 flex items-center justify-center border-[3px] border-[#0D0D0D] mb-4 group-hover:-rotate-12 transition-transform shadow-[4px_4px_0px_0px_#0D0D0D] shrink-0'>
								<Dices size={32} strokeWidth={2.5} />
							</div>
							<h3 className='text-2xl font-black mb-2 uppercase'>Roda Keberuntungan</h3>
							<p className='font-medium border-l-[3px] border-[#A3E635] pl-3 mb-6 flex-grow'>
								Putar roda untuk mengundi giliran atau memilih siswa secara acak.
							</p>
							<button className='w-full bg-gray-200 py-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center justify-center gap-2 font-black uppercase text-gray-500 cursor-not-allowed'>
								Segera Hadir
							</button>
						</div>
					</div>

					{/* Tampilan Grup yang Terbentuk */}
					{targetMode === 'kelompok' && generatedGroupsList && generatedGroupsList.length > 0 && (
						<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] mt-8'>
							<div className='flex justify-between items-center mb-6 border-b-[4px] border-[#0D0D0D] pb-2'>
								<h3 className='text-2xl font-black uppercase tracking-wider flex items-center gap-2'>
									<Users size={28} /> Hasil Pembagian Tim
								</h3>
								<button 
									onClick={generateGroups}
									className='bg-[#F5C518] px-4 py-2 border-[3px] border-[#0D0D0D] font-bold text-sm hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_#0D0D0D] transition-all flex items-center gap-2 uppercase'>
									<RefreshCw size={16} /> Acak Ulang
								</button>
							</div>
							
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
								{generatedGroupsList.map((grup, idx) => (
									<div key={idx} className='border-[3px] border-[#0D0D0D] bg-[#FFF5F0] p-4 relative group'>
										<div className='absolute -top-3 -left-3 bg-[#FF90E8] border-[2px] border-[#0D0D0D] font-black px-3 py-1 shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-2'>
											{grup.nama_tim}
										</div>
										<ul className='mt-4 space-y-1 font-bold'>
											{grup.anggota.map((siswa, sIdx) => (
												<li key={sIdx} className='flex items-center gap-2'>
													<div className='w-1.5 h-1.5 bg-[#0D0D0D] rounded-full'></div>
													{siswa.nama_lengkap}
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Sidebar (Leaderboard / Stats) */}
				<div className='lg:col-span-1'>
					<div className='bg-white p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] sticky top-8'>
						<h3 className='text-xl font-black uppercase mb-4 border-b-[4px] border-[#0D0D0D] pb-2 flex items-center gap-2'>
							<Trophy size={24} className='text-[#F5C518]' /> Status Permainan
						</h3>
						
						<div className='space-y-4 mb-8 font-bold'>
							<div className='flex justify-between items-center bg-[#FFF5F0] p-2 border-2 border-[#0D0D0D]'>
								<span>Kelas:</span>
								<span className='bg-[#A3E635] px-2 py-0.5 border-2 border-[#0D0D0D]'>{selectedKelas || '-'}</span>
							</div>
							<div className='flex justify-between items-center bg-[#FFF5F0] p-2 border-2 border-[#0D0D0D]'>
								<span>Target:</span>
								<span className='bg-[#A3E635] px-2 py-0.5 border-2 border-[#0D0D0D] capitalize'>{targetMode}</span>
							</div>
							{targetMode === 'kelompok' && (
								<div className='flex justify-between items-center bg-[#FFF5F0] p-2 border-2 border-[#0D0D0D]'>
									<span>Jumlah Tim:</span>
									<span className='bg-[#A3E635] px-2 py-0.5 border-2 border-[#0D0D0D]'>{jumlahKelompokStr}</span>
								</div>
							)}
							<div className='flex justify-between items-center bg-[#FFF5F0] p-2 border-2 border-[#0D0D0D]'>
								<span>Peserta Aktif:</span>
								<span className='bg-[#A3E635] px-2 py-0.5 border-2 border-[#0D0D0D]'>{selectedSiswaIds.length}/{siswaList.length}</span>
							</div>
						</div>

						{/* LEADERBOARD SECTION */}
						<h3 className='text-xl font-black uppercase mb-4 border-b-[4px] border-[#0D0D0D] pb-2 flex items-center gap-2'>
							<Trophy size={24} className='text-[#FF4545]' /> Papan Skor
						</h3>
						
						<div className='space-y-3 font-bold max-h-64 overflow-y-auto pr-2'>
							{Object.keys(arisanScores).length === 0 ? (
								<div className='text-center text-gray-500 py-4 bg-gray-100 border-2 border-dashed border-gray-400'>
									Belum ada poin yang dicetak
								</div>
							) : (
								Object.entries(arisanScores)
									.sort((a, b) => b[1] - a[1]) // Sort by score descending
									.map(([name, score], idx) => (
										<div key={name} className='flex justify-between items-center bg-white p-3 border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D]'>
											<div className='flex items-center gap-2'>
												<span className='bg-[#0D0D0D] text-white w-6 h-6 flex items-center justify-center text-sm'>{idx + 1}</span>
												<span className='truncate max-w-[120px]' title={name}>{name}</span>
											</div>
											<span className='bg-[#F5C518] px-2 py-1 border-[3px] border-[#0D0D0D]'>{score}</span>
										</div>
									))
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Instruksi Singkat */}
			<div className='bg-[#2F80ED] text-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-6 -rotate-1 max-w-6xl mx-auto mt-8'>
				<h3 className='text-xl font-black mb-3 uppercase flex items-center gap-2'>
							<HelpCircle /> Cara Bermain
						</h3>
						<p className='font-medium text-sm mb-2'>
							1. Pilih <strong>Kelas</strong> dan atur peserta yang hadir hari ini.
						</p>
						<p className='font-medium text-sm mb-2'>
							2. Pilih <strong>Target</strong>: Mau main secara individu atau dibagi ke dalam tim (kelompok)?
						</p>
						<p className='font-medium text-sm'>
							3. Pilih mode game, dan gunakan proyektor agar layar terlihat oleh seluruh kelas!
						</p>
					</div>
			{/* Modal Pilih Tim untuk Bermain */}
			{showGroupSelectModal && (
				<div className='fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4'>
					<div className='bg-white p-8 max-w-2xl w-full border-[6px] border-[#0D0D0D] shadow-[16px_16px_0px_0px_#FF90E8] relative animate-in fade-in zoom-in'>
						<button 
							onClick={() => setShowGroupSelectModal(false)}
							className='absolute -top-4 -right-4 bg-[#FF4545] text-white w-10 h-10 flex items-center justify-center border-[3px] border-[#0D0D0D] hover:rotate-90 transition-all'>
							<X size={24} strokeWidth={3} />
						</button>
						
						<h2 className='text-3xl font-black uppercase mb-6 border-b-[4px] border-[#0D0D0D] pb-4 flex items-center gap-3'>
							<Play className='text-[#00A693]' size={32} /> Pilih Tim
						</h2>

						<div className='grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2'>
							{generatedGroupsList.map((grup, idx) => (
								<button 
									key={idx}
									onClick={() => handleStartGroupGame(grup.nama_tim)}
									className='flex flex-col items-start text-left p-4 bg-[#FFF5F0] border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all'>
									<div className='font-black text-xl text-[#2F80ED] mb-2'>{grup.nama_tim}</div>
									<div className='text-sm font-bold text-gray-700 line-clamp-3'>
										{grup.anggota.map(a => a.nama_lengkap).join(', ')}
									</div>
								</button>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Modal Peserta (Atur Siswa Hadir/Absen) */}
			{showPesertaModal && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
					<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] max-w-2xl w-full flex flex-col max-h-[85vh] animate-in zoom-in duration-200'>
						
						{/* Modal Header */}
						<div className='bg-[#A3E635] p-4 border-b-[4px] border-[#0D0D0D] flex justify-between items-center'>
							<h2 className='text-2xl font-black uppercase tracking-wider flex items-center gap-2'>
								<UserCheck /> Atur Peserta
							</h2>
							<button 
								onClick={() => setShowPesertaModal(false)}
								className='p-1 bg-white border-[3px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] hover:translate-y-0.5 hover:shadow-none transition-all'>
								<ChevronLeft className='w-6 h-6 rotate-180' strokeWidth={3} />
							</button>
						</div>

						{/* Modal Body */}
						<div className='p-6 overflow-y-auto flex-grow bg-[#FFF5F0]'>
							<p className='font-bold mb-4 bg-white p-3 border-[2px] border-[#0D0D0D]'>
								Uncheck siswa yang tidak hadir (sakit/izin) agar tidak terpilih di dalam game atau kelompok.
							</p>

							<div className='flex gap-2 mb-4'>
								<button onClick={selectAll} className='bg-white border-[2px] border-[#0D0D0D] px-3 py-1 font-bold text-sm shadow-[2px_2px_0px_0px_#0D0D0D] hover:translate-y-px hover:shadow-[1px_1px_0px_0px_#0D0D0D] transition-all'>Pilih Semua</button>
								<button onClick={deselectAll} className='bg-white border-[2px] border-[#0D0D0D] px-3 py-1 font-bold text-sm shadow-[2px_2px_0px_0px_#0D0D0D] hover:translate-y-px hover:shadow-[1px_1px_0px_0px_#0D0D0D] transition-all text-red-600'>Hapus Semua</button>
							</div>

							{loadingSiswa ? (
								<div className='flex justify-center p-8'><RefreshCw className='animate-spin w-8 h-8' /></div>
							) : siswaList.length === 0 ? (
								<div className='text-center p-8 font-bold text-gray-500 bg-white border-[2px] border-dashed border-gray-400'>
									Tidak ada data siswa untuk kelas ini.
								</div>
							) : (
								<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
									{siswaList.map(siswa => {
										const isSelected = selectedSiswaIds.includes(siswa.id);
										return (
											<div 
												key={siswa.id} 
												onClick={() => toggleSiswa(siswa.id)}
												className={`flex items-center gap-3 p-3 border-[3px] border-[#0D0D0D] cursor-pointer transition-all ${isSelected ? 'bg-white shadow-[4px_4px_0px_0px_#0D0D0D]' : 'bg-gray-200 opacity-60'}`}
											>
												<div className={`w-6 h-6 border-[2px] border-[#0D0D0D] flex items-center justify-center bg-white`}>
													{isSelected && <CheckSquare className='w-5 h-5 text-[#2F80ED]' strokeWidth={3} />}
												</div>
												<div className='font-bold flex-grow truncate'>
													{siswa.nama_lengkap}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Modal Footer */}
						<div className='p-4 border-t-[4px] border-[#0D0D0D] bg-white flex justify-end gap-3'>
							<span className='font-black flex-grow flex items-center px-4'>
								TERPILIH: {selectedSiswaIds.length} / {siswaList.length}
							</span>
							<button 
								onClick={() => setShowPesertaModal(false)}
								className='bg-[#2F80ED] text-white px-8 py-3 border-[3px] border-[#0D0D0D] font-black uppercase tracking-wider shadow-[4px_4px_0px_0px_#0D0D0D] hover:translate-y-1 hover:shadow-none transition-all'>
								Selesai
							</button>
						</div>

					</div>
				</div>
			)}
		</div>
	);
}

