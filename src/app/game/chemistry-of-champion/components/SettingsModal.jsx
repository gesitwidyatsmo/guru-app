"use client";
import React, { useState } from 'react';
import { X, Settings, Users, BookOpen, RotateCcw, Save, Trash2, Check, Plus } from 'lucide-react';
import { soundFX } from '../utils/audio';

const EXTRA_COLORS = [
	'#EF4444', '#FACC15', '#EC4899', '#10B981', '#A855F7', 
	'#F97316', '#06B6D4', '#3B82F6', '#059669', '#D97706', '#6366F1', '#84CC16'
];

export default function SettingsModal({
	config,
	teams,
	questions,
	onSaveConfig,
	onResetGame,
	onResetQuestions,
	onClose
}) {
	const [activeTab, setActiveTab] = useState('general'); // 'general' | 'teams' | 'questions'
	const [localConfig, setLocalConfig] = useState({ ...config });
	const [localTeams, setLocalTeams] = useState([...teams]);
	const [savedSuccess, setSavedSuccess] = useState(false);
	const [searchQuestion, setSearchQuestion] = useState('');

	const handleSave = () => {
		soundFX.playCorrect();
		onSaveConfig(localConfig, localTeams);
		setSavedSuccess(true);
		setTimeout(() => setSavedSuccess(false), 2000);
	};

	const handleTeamChange = (index, field, value) => {
		const updated = [...localTeams];
		updated[index] = { ...updated[index], [field]: value };
		setLocalTeams(updated);
	};

	const handleAddTeam = () => {
		if (localTeams.length >= 12) {
			alert('Maksimal 12 tim.');
			return;
		}
		soundFX.playClick();
		const nextIdx = localTeams.length;
		const color = EXTRA_COLORS[nextIdx % EXTRA_COLORS.length];
		setLocalTeams([
			...localTeams,
			{
				id: `team_${Date.now()}_${nextIdx + 1}`,
				name: `TIM ${nextIdx + 1}`,
				color,
				score: 0,
				students: []
			}
		]);
	};

	const handleRemoveTeam = (index) => {
		if (localTeams.length <= 2) {
			alert('Minimal 2 tim untuk bermain.');
			return;
		}
		if (confirm(`Hapus kelompok ${localTeams[index].name}?`)) {
			soundFX.playWrong();
			setLocalTeams(localTeams.filter((_, i) => i !== index));
		}
	};

	const filteredQuestions = questions.filter(
		(q) =>
			q.question.toLowerCase().includes(searchQuestion.toLowerCase()) ||
			q.topic.toLowerCase().includes(searchQuestion.toLowerCase()) ||
			String(q.id).includes(searchQuestion)
	);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
			<div className="relative w-full max-w-3xl bg-[#0F172A] border-2 border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
				
				{/* Header */}
				<div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
							<Settings className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-lg font-black uppercase tracking-wider text-white">
								Pengaturan Game Master
							</h3>
							<p className="text-xs text-slate-400">
								Kustomisasi identitas kelas, {localTeams.length} tim, durasi, dan bank soal
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

				{/* Tabs Navigation */}
				<div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-3 gap-2">
					<button
						onClick={() => setActiveTab('general')}
						className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs uppercase tracking-wider border-t border-x transition ${
							activeTab === 'general'
								? 'bg-[#0F172A] border-slate-700 text-cyan-400'
								: 'border-transparent text-slate-400 hover:text-slate-200'
						}`}
					>
						<Settings className="w-4 h-4" />
						Informasi & Tampilan
					</button>

					<button
						onClick={() => setActiveTab('teams')}
						className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs uppercase tracking-wider border-t border-x transition ${
							activeTab === 'teams'
								? 'bg-[#0F172A] border-slate-700 text-cyan-400'
								: 'border-transparent text-slate-400 hover:text-slate-200'
						}`}
					>
						<Users className="w-4 h-4" />
						Kelompok / Tim ({localTeams.length})
					</button>

					<button
						onClick={() => setActiveTab('questions')}
						className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl font-bold text-xs uppercase tracking-wider border-t border-x transition ${
							activeTab === 'questions'
								? 'bg-[#0F172A] border-slate-700 text-cyan-400'
								: 'border-transparent text-slate-400 hover:text-slate-200'
						}`}
					>
						<BookOpen className="w-4 h-4" />
						Bank Soal ({questions.length})
					</button>
				</div>

				{/* Tab Content */}
				<div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
					
					{/* TAB: GENERAL */}
					{activeTab === 'general' && (
						<div className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
										Judul Game
									</label>
									<input
										type="text"
										value={localConfig.gameTitle}
										onChange={(e) => setLocalConfig({ ...localConfig, gameTitle: e.target.value })}
										className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-400"
									/>
								</div>

								<div>
									<label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
										Nama Sub-Judul / Kelas Guru
									</label>
									<input
										type="text"
										value={localConfig.subTitle}
										onChange={(e) => setLocalConfig({ ...localConfig, subTitle: e.target.value })}
										className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>

								<div>
									<label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
										Label Kelas
									</label>
									<input
										type="text"
										value={localConfig.className}
										onChange={(e) => setLocalConfig({ ...localConfig, className: e.target.value })}
										className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>

								<div>
									<label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
										Nama Guru / Game Master
									</label>
									<input
										type="text"
										value={localConfig.teacherName}
										onChange={(e) => setLocalConfig({ ...localConfig, teacherName: e.target.value })}
										className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>
							</div>

							<div>
								<label className="block text-xs uppercase font-bold text-slate-400 mb-1.5">
									Slogan / Tagline
								</label>
								<input
									type="text"
									value={localConfig.tagline}
									onChange={(e) => setLocalConfig({ ...localConfig, tagline: e.target.value })}
									className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-white italic focus:outline-none focus:border-cyan-400"
								/>
							</div>

							{/* Reset Actions */}
							<div className="pt-4 border-t border-slate-800">
								<h4 className="text-xs uppercase font-bold text-rose-400 mb-3 flex items-center gap-1.5">
									<RotateCcw className="w-4 h-4" /> Zona Reset Permainan
								</h4>
								<div className="flex flex-wrap gap-3">
									<button
										onClick={() => {
											if (confirm("Yakin ingin mereset skor semua tim dan status papan soal?")) {
												onResetGame();
											}
										}}
										className="px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 text-xs font-bold transition flex items-center gap-2"
									>
										<Trash2 className="w-4 h-4" /> Reset Skor & Papan Soal
									</button>

									<button
										onClick={() => {
											if (confirm("Reset seluruh bank soal ke 100 soal bawaan kimia standar?")) {
												onResetQuestions();
											}
										}}
										className="px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-xs font-bold transition flex items-center gap-2"
									>
										<RotateCcw className="w-4 h-4" /> Reset Bank Soal Bawaan (100 Soal)
									</button>
								</div>
							</div>
						</div>
					)}

					{/* TAB: TEAMS */}
					{activeTab === 'teams' && (
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<p className="text-xs text-slate-400">
									Sesuaikan nama, warna, atau tambah/hapus kelompok ({localTeams.length} Tim):
								</p>

								{localTeams.length < 12 && (
									<button
										onClick={handleAddTeam}
										className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition flex items-center gap-1 shadow-sm"
									>
										<Plus className="w-3.5 h-3.5" /> + Tambah Tim
									</button>
								)}
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								{localTeams.map((team, idx) => (
									<div
										key={team.id || idx}
										className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/80 flex items-center gap-3 relative group"
									>
										<input
											type="color"
											value={team.color}
											onChange={(e) => handleTeamChange(idx, 'color', e.target.value)}
											className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 shrink-0"
										/>
										<div className="flex-1">
											<label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
												Tim #{idx + 1} ({team.students?.length || 0} Siswa)
											</label>
											<input
												type="text"
												value={team.name}
												onChange={(e) => handleTeamChange(idx, 'name', e.target.value)}
												className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white uppercase focus:outline-none focus:border-cyan-400"
											/>
										</div>

										{localTeams.length > 2 && (
											<button
												onClick={() => handleRemoveTeam(idx)}
												className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 opacity-0 group-hover:opacity-100 transition"
												title="Hapus tim ini"
											>
												<Trash2 className="w-3.5 h-3.5" />
											</button>
										)}
									</div>
								))}
							</div>
						</div>
					)}

					{/* TAB: QUESTIONS */}
					{activeTab === 'questions' && (
						<div className="space-y-4">
							<div className="flex items-center justify-between gap-4">
								<input
									type="text"
									placeholder="Cari nomor, topik, atau kata kunci soal..."
									value={searchQuestion}
									onChange={(e) => setSearchQuestion(e.target.value)}
									className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
								/>
							</div>

							<div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
								{filteredQuestions.map((q) => (
									<div
										key={q.id}
										className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-xs space-y-1 hover:border-slate-600 transition"
									>
										<div className="flex items-center justify-between">
											<span className="font-mono font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
												#{q.id} - {q.topic}
											</span>
											<span className="text-emerald-400 font-bold">
												Kunci: {q.answer}
											</span>
										</div>
										<p className="text-slate-200 font-medium pt-1">
											{q.question}
										</p>
									</div>
								))}
								{filteredQuestions.length === 0 && (
									<p className="text-center text-slate-500 py-6 text-xs">
										Tidak ada soal yang cocok dengan pencarian.
									</p>
								)}
							</div>
						</div>
					)}

				</div>

				{/* Footer Bar */}
				<div className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
					<div>
						{savedSuccess && (
							<span className="text-xs text-emerald-400 font-bold flex items-center gap-1.5 animate-in fade-in">
								<Check className="w-4 h-4" /> Pengaturan Tersimpan!
							</span>
						)}
					</div>

					<div className="flex items-center gap-3">
						<button
							onClick={onClose}
							className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
						>
							Tutup
						</button>

						<button
							onClick={handleSave}
							className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider transition flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
						>
							<Save className="w-4 h-4" /> Simpan Perubahan
						</button>
					</div>
				</div>

			</div>
		</div>
	);
}
