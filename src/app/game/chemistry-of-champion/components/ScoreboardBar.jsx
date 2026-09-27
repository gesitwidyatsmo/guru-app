"use client";
import React from 'react';
import { Plus, Minus, Users } from 'lucide-react';
import { soundFX } from '../utils/audio';

export default function ScoreboardBar({ teams, onUpdateScore, onViewRoster }) {
	const handleAdjust = (teamId, delta, e) => {
		e.stopPropagation();
		soundFX.playClick();
		onUpdateScore(teamId, delta);
	};

	return (
		<div className="w-full bg-[#0D182E]/90 border border-slate-700/80 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-lg flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
			<div className="flex items-center justify-between md:justify-start gap-3 px-2 shrink-0">
				<span className="text-xs uppercase font-black tracking-widest text-cyan-400">
					SCOREBOARD
				</span>

				{onViewRoster && (
					<button
						onClick={onViewRoster}
						className="text-[10px] font-bold text-slate-400 hover:text-cyan-300 bg-slate-800/80 hover:bg-slate-700/80 px-2.5 py-1 rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
						title="Lihat daftar nama siswa per kelompok"
					>
						<Users className="w-3 h-3 text-cyan-400" />
						<span>Anggota Siswa</span>
					</button>
				)}
			</div>

			<div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 flex-1">
				{teams.map((team) => (
					<div
						key={team.id}
						onClick={() => onViewRoster && onViewRoster()}
						className="relative bg-slate-900/90 border rounded-xl p-2.5 flex flex-col items-center justify-between transition-all hover:scale-[1.02] shadow-sm group cursor-pointer"
						style={{ borderColor: `${team.color}60` }}
						title={team.students?.length ? `${team.name}: ${team.students.join(', ')}` : team.name}
					>
						{/* Team Label & Dot */}
						<div className="flex items-center gap-1.5 mb-1 max-w-full">
							<span
								className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
								style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}` }}
							/>
							<span className="text-[11px] font-black uppercase text-slate-200 truncate">
								{team.name}
							</span>
						</div>

						{/* Score Value */}
						<span
							className="text-xl sm:text-2xl font-black font-mono tracking-tight my-0.5"
							style={{ color: team.color }}
						>
							{team.score}
						</span>

						{/* Quick Adjuster (+ / -) */}
						<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
							<button
								onClick={(e) => handleAdjust(team.id, -5, e)}
								className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 flex items-center justify-center text-[10px] transition"
								title="Kurang 5 poin"
							>
								<Minus className="w-3 h-3" />
							</button>
							<button
								onClick={(e) => handleAdjust(team.id, 10, e)}
								className="w-5 h-5 rounded bg-slate-800 hover:bg-emerald-900/60 text-slate-300 hover:text-emerald-300 flex items-center justify-center text-[10px] transition"
								title="Tambah 10 poin"
							>
								<Plus className="w-3 h-3" />
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
