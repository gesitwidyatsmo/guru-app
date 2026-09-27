"use client";
import React from 'react';
import { X, Users, User, Trophy, Sparkles } from 'lucide-react';

export default function TeamRosterModal({ game, onClose }) {
	if (!game) return null;

	const sortedTeams = [...(game.teams || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
			<div className="relative w-full max-w-3xl bg-[#0F172A] border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[85vh]">
				
				{/* Top Header */}
				<div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
							<Users className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-lg font-black uppercase tracking-wider text-white">
								Daftar Kelompok & Anggota Siswa
							</h3>
							<p className="text-xs text-slate-400">
								{game.config?.gameTitle} • Kelas {game.config?.className} ({game.teams?.length || 0} Kelompok)
							</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Body Content */}
				<div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{sortedTeams.map((team, idx) => (
							<div
								key={team.id || idx}
								className="p-4 rounded-2xl bg-slate-800/60 border rounded-2xl flex flex-col justify-between space-y-3"
								style={{ borderColor: `${team.color}60` }}
							>
								{/* Team Header */}
								<div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
									<div className="flex items-center gap-2">
										<span
											className="w-3.5 h-3.5 rounded-full"
											style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}` }}
										/>
										<h4 className="font-black text-sm uppercase text-white">
											{team.name}
										</h4>
									</div>

									<div className="flex items-center gap-2">
										<span className="text-xs font-mono font-bold text-cyan-300 bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-700">
											{team.score || 0} Poin
										</span>
									</div>
								</div>

								{/* Student Roster List */}
								<div className="space-y-1.5 flex-1">
									<span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center gap-1">
										<User className="w-3 h-3 text-cyan-400" />
										Anggota Siswa ({team.students?.length || 0}):
									</span>

									{team.students && team.students.length > 0 ? (
										<div className="flex flex-wrap gap-1.5 pt-1">
											{team.students.map((student, sIdx) => (
												<span
													key={sIdx}
													className="text-xs bg-slate-900/90 text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700/80 font-medium"
												>
													{student}
												</span>
											))}
										</div>
									) : (
										<p className="text-xs text-slate-500 italic pt-1">
											Belum ada nama siswa terdaftar pada kelompok ini.
										</p>
									)}
								</div>

							</div>
						))}
					</div>
				</div>

				{/* Footer */}
				<div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex items-center justify-end">
					<button
						onClick={onClose}
						className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
					>
						Tutup
					</button>
				</div>

			</div>
		</div>
	);
}
