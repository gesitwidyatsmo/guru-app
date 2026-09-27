"use client";
import React, { useEffect, useRef } from 'react';
import { Trophy, Medal, Award, RotateCcw, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { soundFX } from '../utils/audio';

export default function PodiumModal({
	teams,
	answeredCount,
	totalCount,
	durationStr,
	onRestart,
	onClose
}) {
	const canvasRef = useRef(null);

	// Sort teams descending by score
	const sortedTeams = [...teams].sort((a, b) => b.score - a.score);
	const winner = sortedTeams[0];
	const second = sortedTeams[1];
	const third = sortedTeams[2];

	// Canvas Confetti effect
	useEffect(() => {
		soundFX.playVictory();

		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');

		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;

		const particles = [];
		const colors = ['#EF4444', '#F59E0B', '#EC4899', '#10B981', '#8B5CF6', '#F97316', '#38BDF8', '#FACC15'];

		for (let i = 0; i < 150; i++) {
			particles.push({
				x: Math.random() * canvas.width,
				y: Math.random() * canvas.height - canvas.height,
				size: Math.random() * 8 + 4,
				color: colors[Math.floor(Math.random() * colors.length)],
				speedY: Math.random() * 3 + 2,
				speedX: Math.random() * 2 - 1,
				rotation: Math.random() * 360,
				rotationSpeed: Math.random() * 10 - 5
			});
		}

		let animationId;
		const render = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			particles.forEach((p) => {
				ctx.save();
				ctx.translate(p.x, p.y);
				ctx.rotate((p.rotation * Math.PI) / 180);
				ctx.fillStyle = p.color;
				ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
				ctx.restore();

				p.y += p.speedY;
				p.x += p.speedX;
				p.rotation += p.rotationSpeed;

				if (p.y > canvas.height) {
					p.y = -10;
					p.x = Math.random() * canvas.width;
				}
			});

			animationId = requestAnimationFrame(render);
		};

		render();

		return () => {
			if (animationId) cancelAnimationFrame(animationId);
		};
	}, []);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
			{/* Confetti Canvas */}
			<canvas
				ref={canvasRef}
				className="absolute inset-0 pointer-events-none z-0"
			/>

			<div className="relative z-10 w-full max-w-4xl bg-gradient-to-b from-[#0F172A] to-[#0A0F1D] border-2 border-amber-500/50 rounded-3xl shadow-[0_0_60px_rgba(245,158,11,0.3)] overflow-hidden flex flex-col text-slate-100 max-h-[95vh]">
				
				{/* Top Ribbon */}
				<div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 py-3 text-center shadow-lg">
					<h2 className="text-black font-black uppercase tracking-widest text-lg sm:text-2xl flex items-center justify-center gap-2">
						<Sparkles className="w-6 h-6 fill-black" />
						UPACARA KEMENANGAN CHAMPION
						<Sparkles className="w-6 h-6 fill-black" />
					</h2>
				</div>

				<div className="p-6 md:p-10 overflow-y-auto space-y-8 custom-scrollbar">
					
					{/* Winner Announcement Banner */}
					<div className="text-center space-y-2">
						<div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 text-xs font-bold uppercase tracking-wider">
							<Trophy className="w-4 h-4 text-amber-400" /> Juara Utama Kimia
						</div>
						<h1 className="text-3xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 uppercase tracking-tight drop-shadow-md">
							SELAMAT KEPADA {winner?.name}!
						</h1>
						<p className="text-slate-400 text-sm">
							Berhasil meraih skor tertinggi dengan total <strong className="text-amber-400 text-base">{winner?.score} Poin</strong>
						</p>
					</div>

					{/* 3D-like Podium Layout */}
					<div className="flex items-end justify-center gap-3 sm:gap-6 pt-4 pb-2">
						
						{/* 2nd Place (Silver) */}
						{second && (
							<div className="flex-1 max-w-[180px] flex flex-col items-center">
								<div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-300/20 border-2 border-slate-300 flex items-center justify-center text-slate-200 shadow-lg mb-2 animate-bounce">
									<Medal className="w-7 h-7 text-slate-300" />
								</div>
								<span
									className="text-xs sm:text-sm font-black uppercase truncate px-2 py-0.5 rounded-md mb-1"
									style={{ backgroundColor: second.color, color: '#000' }}
								>
									{second.name}
								</span>
								<span className="text-xs font-bold text-slate-300 mb-2 font-mono">
									{second.score} Poin
								</span>
								<div className="w-full h-32 sm:h-40 bg-gradient-to-t from-slate-800 to-slate-600 rounded-t-2xl border-t-4 border-slate-300 flex items-center justify-center flex-col shadow-xl">
									<span className="text-3xl sm:text-4xl font-black text-slate-200">2</span>
									<span className="text-[10px] font-bold text-slate-400 uppercase">RUNNER UP</span>
								</div>
							</div>
						)}

						{/* 1st Place (Gold) */}
						{winner && (
							<div className="flex-1 max-w-[200px] flex flex-col items-center">
								<div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-amber-500/30 border-4 border-yellow-400 flex items-center justify-center text-yellow-300 shadow-[0_0_30px_rgba(234,179,8,0.6)] mb-2 animate-pulse">
									<Trophy className="w-9 h-9 sm:w-11 sm:h-11 text-yellow-400" />
								</div>
								<span
									className="text-sm sm:text-base font-black uppercase truncate px-3 py-1 rounded-lg mb-1 shadow-md"
									style={{ backgroundColor: winner.color, color: '#000' }}
								>
									{winner.name}
								</span>
								<span className="text-sm font-extrabold text-amber-300 mb-2 font-mono">
									{winner.score} Poin
								</span>
								<div className="w-full h-44 sm:h-52 bg-gradient-to-t from-amber-900 to-yellow-600 rounded-t-2xl border-t-4 border-yellow-300 flex items-center justify-center flex-col shadow-2xl relative overflow-hidden">
									<div className="absolute inset-0 bg-yellow-400/10 pointer-events-none" />
									<span className="text-4xl sm:text-5xl font-black text-yellow-100">1</span>
									<span className="text-xs font-black text-yellow-950 bg-yellow-400 px-2 py-0.5 rounded-full uppercase mt-1">
										CHAMPION
									</span>
								</div>
							</div>
						)}

						{/* 3rd Place (Bronze) */}
						{third && (
							<div className="flex-1 max-w-[180px] flex flex-col items-center">
								<div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-700/20 border-2 border-amber-600 flex items-center justify-center text-amber-500 shadow-lg mb-2">
									<Award className="w-7 h-7 text-amber-500" />
								</div>
								<span
									className="text-xs sm:text-sm font-black uppercase truncate px-2 py-0.5 rounded-md mb-1"
									style={{ backgroundColor: third.color, color: '#000' }}
								>
									{third.name}
								</span>
								<span className="text-xs font-bold text-amber-400 mb-2 font-mono">
									{third.score} Poin
								</span>
								<div className="w-full h-24 sm:h-28 bg-gradient-to-t from-amber-950 to-amber-800 rounded-t-2xl border-t-4 border-amber-600 flex items-center justify-center flex-col shadow-xl">
									<span className="text-3xl sm:text-4xl font-black text-amber-300">3</span>
									<span className="text-[10px] font-bold text-amber-500 uppercase">3RD PLACE</span>
								</div>
							</div>
						)}

					</div>

					{/* Summary Stats Table (Ranks 4-6 & Game Stats) */}
					<div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
						<h3 className="text-xs uppercase font-bold tracking-wider text-slate-400">
							Klasemen Lengkap & Statistik Arena:
						</h3>

						<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pb-3 border-b border-slate-800">
							<div className="p-3 bg-slate-800/50 rounded-xl">
								<span className="text-[10px] uppercase font-bold text-slate-400 block">Soal Dijawab</span>
								<span className="text-lg font-bold text-cyan-400 font-mono">{answeredCount} / {totalCount}</span>
							</div>
							<div className="p-3 bg-slate-800/50 rounded-xl">
								<span className="text-[10px] uppercase font-bold text-slate-400 block">Durasi Main</span>
								<span className="text-lg font-bold text-yellow-400 font-mono">{durationStr}</span>
							</div>
							<div className="p-3 bg-slate-800/50 rounded-xl">
								<span className="text-[10px] uppercase font-bold text-slate-400 block">Total Poin</span>
								<span className="text-lg font-bold text-emerald-400 font-mono">
									{teams.reduce((acc, t) => acc + t.score, 0)}
								</span>
							</div>
							<div className="p-3 bg-slate-800/50 rounded-xl">
								<span className="text-[10px] uppercase font-bold text-slate-400 block">Jumlah Tim</span>
								<span className="text-lg font-bold text-purple-400 font-mono">{teams.length}</span>
							</div>
						</div>

						{/* 4 to 6 places */}
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
							{sortedTeams.slice(3).map((team, idx) => (
								<div
									key={team.id}
									className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-xs"
								>
									<div className="flex items-center gap-2">
										<span className="w-5 h-5 rounded-md bg-slate-700 text-slate-300 font-bold flex items-center justify-center text-[10px]">
											{idx + 4}
										</span>
										<span
											className="w-2.5 h-2.5 rounded-full"
											style={{ backgroundColor: team.color }}
										/>
										<span className="font-bold text-slate-200 uppercase">{team.name}</span>
									</div>
									<span className="font-mono font-bold text-slate-300">{team.score} Poin</span>
								</div>
							))}
						</div>
					</div>

				</div>

				{/* Action Footer */}
				<div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
					<button
						onClick={onClose}
						className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
					>
						Kembali ke Papan Arena
					</button>

					<button
						onClick={onRestart}
						className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
					>
						<RotateCcw className="w-4 h-4" /> Mulai Babak Baru
					</button>
				</div>

			</div>
		</div>
	);
}
