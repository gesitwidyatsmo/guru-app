"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { ChevronLeft, Play, RefreshCw, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { bankSoal } from '../data';

// Komponen inti game — menggunakan useSearchParams, HARUS ada di dalam <Suspense>
function TebakGambarContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const timParam = searchParams.get('tim');
	
	const [peserta, setPeserta] = useState([]);
	const [mode, setMode] = useState('');
	
	const [gameState, setGameState] = useState('idle'); // idle, playing, result
	const [currentSoal, setCurrentSoal] = useState(null);
	const [currentPenebak, setCurrentPenebak] = useState(null);
	const [timer, setTimer] = useState(60);
	const [score, setScore] = useState(0);

	useEffect(() => {
		// Load data from sessionStorage
		const storedData = sessionStorage.getItem('arisan_game_data');
		if (storedData) {
			const parsed = JSON.parse(storedData);
			setMode(parsed.mode);
			
			if (parsed.mode === 'individu') {
				setPeserta(parsed.peserta);
			} else {
				setPeserta(parsed.peserta); // it's an array of groups
			}
		} else {
			alert('Data peserta tidak ditemukan. Kembali ke dashboard.');
			router.push('/game/arisan');
		}
	}, [router]);

	useEffect(() => {
		let interval;
		if (gameState === 'playing' && timer > 0) {
			interval = setInterval(() => {
				setTimer(prev => prev - 1);
			}, 1000);
		} else if (timer === 0 && gameState === 'playing') {
			setGameState('result');
			saveScore(); // Save score when timer hits 0
		}
		return () => clearInterval(interval);
	}, [gameState, timer]);

	const saveScore = () => {
		if (!currentPenebak) return;
		const nameKey = currentPenebak.nama_lengkap || currentPenebak.nama_tim || currentPenebak.nama;
		const storedScores = sessionStorage.getItem('arisan_scores');
		let scores = storedScores ? JSON.parse(storedScores) : {};
		
		// Add new score to existing score if any
		scores[nameKey] = (scores[nameKey] || 0) + score;
		
		sessionStorage.setItem('arisan_scores', JSON.stringify(scores));
	};

	const startGame = () => {
		if (mode === 'kelompok' && timParam) {
			// Mode Kelompok: Set penebak to the selected team name
			setCurrentPenebak({ nama_tim: timParam });
		} else {
			// Mode Individu: Pick random penebak
			if (peserta.length === 0) return;
			const penebakRandom = peserta[Math.floor(Math.random() * peserta.length)];
			setCurrentPenebak(penebakRandom);
		}
		
		// Pick random soal
		nextSoal();
		
		setScore(0);
		setTimer(60);
		setGameState('playing');
	};

	const nextSoal = () => {
		const soalRandom = bankSoal[Math.floor(Math.random() * bankSoal.length)];
		setCurrentSoal(soalRandom);
	};

	const handleBenar = () => {
		setScore(prev => prev + 100);
		nextSoal();
	};

	const handleLewati = () => {
		nextSoal();
	};

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] p-6 md:p-12 font-sans flex flex-col'>
			
			{/* Header */}
			<div className='w-full max-w-6xl mx-auto flex items-center justify-between mb-8'>
				<Link href="/game/arisan">
					<button className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
						<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
					</button>
				</Link>
				<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-2 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>TEBAK GAMBAR</h1>
				</div>
			</div>

			{/* Main Game Area */}
			<div className='flex-grow flex items-center justify-center max-w-6xl mx-auto w-full'>
				
				{gameState === 'idle' && (
					<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] p-12 text-center max-w-2xl w-full flex flex-col items-center gap-6'>
						<div className='bg-[#FF90E8] w-24 h-24 flex items-center justify-center border-[4px] border-[#0D0D0D] mb-4 -rotate-3 shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<Play size={48} strokeWidth={2.5} className='text-white' />
						</div>
						<h2 className='text-4xl font-black uppercase'>Siap Bermain?</h2>
						<p className='text-lg font-bold bg-[#FFF5F0] p-4 border-[2px] border-[#0D0D0D]'>
							{mode === 'kelompok' 
								? `Kelompok ${timParam} akan menebak! Anggota lain bertugas memberikan clue dari gambar yang muncul di layar.` 
								: `Sistem akan memilih 1 murid secara acak untuk menebak. Murid lain bertugas memberikan clue dari gambar yang muncul di layar!`
							}
						</p>
						<button 
							onClick={startGame}
							className='w-full max-w-md mt-4 bg-[#2F80ED] text-white py-4 text-2xl font-black uppercase tracking-wider border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all'>
							{mode === 'kelompok' ? 'Mulai' : 'Mulai Acak Penebak'}
						</button>
					</div>
				)}

				{gameState === 'playing' && currentSoal && currentPenebak && (
					<div className='w-full grid grid-cols-1 lg:grid-cols-4 gap-8'>
						
						{/* Sidebar Info */}
						<div className='lg:col-span-1 space-y-6'>
							<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-4 -rotate-2'>
								<h3 className='font-black uppercase mb-2 border-b-[3px] border-[#0D0D0D] pb-1'>Penebak</h3>
								<div className='text-xl font-bold text-[#2F80ED]'>
									{currentPenebak.nama_lengkap || currentPenebak.nama}
								</div>
							</div>
							
							<div className='bg-[#F5C518] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-4 rotate-1 text-center'>
								<h3 className='font-black uppercase mb-1'>Waktu</h3>
								<div className={`text-5xl font-black ${timer <= 10 ? 'text-[#FF4545] animate-pulse' : 'text-[#0D0D0D]'}`}>
									{timer}s
								</div>
							</div>
							
							<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-4'>
								<h3 className='font-black uppercase mb-1 text-center'>Skor</h3>
								<div className='text-3xl font-black text-center text-[#00A693]'>{score}</div>
							</div>
						</div>

						{/* Main Board */}
						<div className='lg:col-span-3 bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] flex flex-col'>
							
							{/* Kategori Label */}
							<div className='bg-[#FF90E8] border-b-[4px] border-[#0D0D0D] p-3 text-center'>
								<span className='font-black text-xl uppercase tracking-widest'>{currentSoal.kategori}</span>
							</div>

							{/* Soal Content */}
							<div className='flex-grow p-8 flex flex-col items-center justify-center bg-gray-50 relative'>
								<div className='absolute top-4 right-4 bg-[#A3E635] px-4 py-1 border-[2px] border-[#0D0D0D] font-bold rotate-3'>
									{currentSoal.kata}
								</div>
								
								<img 
									src={currentSoal.gambar} 
									alt={currentSoal.kata}
									className='w-full max-w-lg max-h-80 object-contain border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] mb-8 bg-white p-2'
								/>
								
								<h2 className='text-5xl md:text-7xl font-black uppercase tracking-widest text-[#0D0D0D]'>
									{currentSoal.kata}
								</h2>
							</div>

							{/* Controls */}
							<div className='bg-[#0D0D0D] p-4 flex justify-between gap-4'>
								<button 
									onClick={handleLewati}
									className='flex-1 bg-[#FF4545] text-white py-4 border-[3px] border-white font-black text-xl uppercase flex items-center justify-center gap-2 hover:bg-red-600 active:scale-95 transition-all'>
									<X strokeWidth={3} /> Lewati
								</button>
								<button 
									onClick={handleBenar}
									className='flex-1 bg-[#00A693] text-white py-4 border-[3px] border-white font-black text-xl uppercase flex items-center justify-center gap-2 hover:bg-teal-600 active:scale-95 transition-all'>
									<Check strokeWidth={3} /> Benar
								</button>
							</div>
						</div>

					</div>
				)}

				{gameState === 'result' && (
					<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] p-12 text-center max-w-2xl w-full flex flex-col items-center gap-6 animate-in zoom-in'>
						<h2 className='text-5xl font-black uppercase text-[#FF4545] rotate-2'>Waktu Habis!</h2>
						<div className='bg-[#A3E635] p-6 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] w-full -rotate-1'>
							<h3 className='text-xl font-bold uppercase mb-2'>Skor Akhir</h3>
							<div className='text-7xl font-black text-[#0D0D0D]'>{score}</div>
						</div>
						<div className='flex gap-4 w-full mt-6'>
							<button 
								onClick={() => router.push('/game/arisan')}
								className='flex-1 bg-white py-4 text-xl font-black uppercase tracking-wider border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 active:translate-y-1 transition-all'>
								Kembali
							</button>
							<button 
								onClick={startGame}
								className='flex-1 bg-[#F5C518] py-4 text-xl font-black uppercase tracking-wider border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 active:translate-y-1 transition-all flex items-center justify-center gap-2'>
								<RefreshCw strokeWidth={3} /> Main Lagi
							</button>
						</div>
					</div>
				)}

			</div>
		</div>
	);
}

// Halaman utama — wajib wrap komponen yang menggunakan useSearchParams dengan <Suspense>
export default function TebakGambar() {
	return (
		<Suspense fallback={
			<div className='min-h-screen bg-[#FFF5F0] flex items-center justify-center'>
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-8 text-center'>
					<div className='text-2xl font-black uppercase'>Memuat Game...</div>
				</div>
			</div>
		}>
			<TebakGambarContent />
		</Suspense>
	);
}
