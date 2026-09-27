"use client";
import React, { useState } from 'react';
import { 
	X, 
	BookOpen, 
	Plus, 
	Trash2, 
	Edit3, 
	Download, 
	Upload, 
	Sparkles, 
	CheckCircle, 
	Search, 
	Layers, 
	FileText, 
	ArrowRight,
	HelpCircle,
	GraduationCap,
	Tag,
	Filter
} from 'lucide-react';
import { soundFX } from '../utils/audio';

const GRADE_OPTIONS = [
	'Semua Tingkat',
	'Kelas 7',
	'Kelas 8',
	'Kelas 9',
	'Kelas 10',
	'Kelas 11',
	'Kelas 12'
];

export default function QuestionBankManagerModal({
	packages = [],
	activePackageId,
	onSelectPackage,
	onCreatePackage,
	onUpdatePackage,
	onDeletePackage,
	onSyncToDb,
	onClose
}) {
	const [selectedPkgId, setSelectedPkgId] = useState(activePackageId || (packages[0]?.id || null));
	const [searchTerm, setSearchTerm] = useState('');
	const [activeTab, setActiveTab] = useState('list'); // 'list' | 'add_manual' | 'bulk_import' | 'new_package'
	const [syncing, setSyncing] = useState(false);

	// Filters for Packages
	const [filterSubject, setFilterSubject] = useState('all');
	const [filterGrade, setFilterGrade] = useState('all');

	// Form State for Manual Add/Edit
	const [editingQuestionId, setEditingQuestionId] = useState(null);
	const [singleForm, setSingleForm] = useState({
		topic: 'Genetika',
		grade: 'Kelas XII',
		question: '',
		options: ['', '', '', ''],
		answer: '',
		explanation: '',
		points: 10
	});

	// Form State for Bulk Import Text
	const [bulkText, setBulkText] = useState('');
	const [bulkDefaultTopic, setBulkDefaultTopic] = useState('Materi Umum');
	const [bulkDefaultGrade, setBulkDefaultGrade] = useState('Kelas XII');
	const [bulkSuccessMsg, setBulkSuccessMsg] = useState('');

	// Form State for New Package
	const [newPkgForm, setNewPkgForm] = useState({
		name: '',
		subject: 'Biologi',
		grade: 'Kelas 7',
		materi: '',
		icon: '🧬',
		gameTitle: 'ARENA OF CHAMPION',
		tagline: 'Think Fast. Solve Smart. Become the Champion!'
	});

	const currentPkg = packages.find((p) => p.id === selectedPkgId) || packages[0];
	const questionsList = currentPkg?.questions || [];

	// Filtered Packages based on subject/grade filter
	const filteredPackages = packages.filter((pkg) => {
		if (filterSubject !== 'all' && pkg.subject?.toLowerCase() !== filterSubject.toLowerCase()) return false;
		if (filterGrade !== 'all' && pkg.grade !== filterGrade) return false;
		return true;
	});

	// Unique list of subjects in packages
	const uniqueSubjects = ['all', ...new Set(packages.map((p) => p.subject || 'Umum'))];

	// Filtered Questions in current package
	const filteredQuestions = questionsList.filter(
		(q) =>
			q.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			q.topic?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			q.grade?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			String(q.id).includes(searchTerm)
	);

	// Start adding new question manually
	const handleStartAddManual = () => {
		setEditingQuestionId(null);
		setSingleForm({
			topic: currentPkg?.materi || currentPkg?.name || 'Materi Pokok',
			grade: currentPkg?.grade || 'Kelas XII',
			question: '',
			options: ['', '', '', ''],
			answer: '',
			explanation: '',
			points: 10
		});
		setActiveTab('add_manual');
	};

	// Start editing existing question
	const handleStartEdit = (q) => {
		setEditingQuestionId(q.id);
		setSingleForm({
			topic: q.topic || currentPkg?.materi || 'Umum',
			grade: q.grade || currentPkg?.grade || 'Kelas XII',
			question: q.question || '',
			options: q.options ? [...q.options] : ['', '', '', ''],
			answer: q.answer || '',
			explanation: q.explanation || '',
			points: q.points || 10
		});
		setActiveTab('add_manual');
	};

	// Save Single Question (Create or Edit)
	const handleSaveSingleQuestion = (e) => {
		e.preventDefault();
		soundFX.playCorrect();

		const updatedQuestions = [...questionsList];

		if (editingQuestionId) {
			const idx = updatedQuestions.findIndex((q) => q.id === editingQuestionId);
			if (idx !== -1) {
				updatedQuestions[idx] = {
					...updatedQuestions[idx],
					...singleForm,
					options: singleForm.options.filter((o) => o.trim().length > 0)
				};
			}
		} else {
			const numericIds = updatedQuestions
				.map((q) => typeof q.id === 'number' ? q.id : parseInt(q.id))
				.filter((id) => !isNaN(id));
			const newId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
			updatedQuestions.push({
				id: newId,
				...singleForm,
				options: singleForm.options.filter((o) => o.trim().length > 0)
			});
		}

		onUpdatePackage(currentPkg.id, { questions: updatedQuestions });
		setActiveTab('list');
		setEditingQuestionId(null);
	};

	// Delete a question from package
	const handleDeleteQuestion = async (qId) => {
		if (confirm(`Hapus soal nomor #${qId}?`)) {
			soundFX.playWrong();
			const toDelete = questionsList.find((q) => q.id === qId);
			const updatedQuestions = questionsList.filter((q) => q.id !== qId);
			onUpdatePackage(currentPkg.id, { questions: updatedQuestions });

			// Hapus dari DB jika soal ini sudah tersimpan (punya dbId)
			if (toDelete?.dbId) {
				fetch(`/api/game/questions?id=${toDelete.dbId}`, { method: 'DELETE' })
					.catch((err) => console.error('Gagal hapus soal dari DB:', err));
			}
		}
	};

	// Parse & Import Bulk Text
	const handleProcessBulkImport = () => {
		if (!bulkText.trim()) return;
		soundFX.playCorrect();

		try {
			const blocks = bulkText.split(/\n\s*(?=\d+[\.\)]|\bSoal\s*\d+)/i).filter((b) => b.trim());
			const parsedQuestions = [];

			let startId = questionsList.length > 0 ? Math.max(...questionsList.map((q) => q.id)) + 1 : 1;

			blocks.forEach((block) => {
				const lines = block.split('\n').map((l) => l.trim()).filter((l) => l);
				if (lines.length === 0) return;

				let qText = lines[0].replace(/^\d+[\.\)]\s*/, '');
				let topic = bulkDefaultTopic || 'Umum';
				let grade = bulkDefaultGrade || currentPkg?.grade || 'Kelas XII';

				// Detect [Topik] e.g. [Genetika] Pertanyaan...
				const topicMatch = qText.match(/^\[(.*?)\]\s*(.*)/);
				if (topicMatch) {
					topic = topicMatch[1];
					qText = topicMatch[2];
				}

				const options = [];
				let answer = '';
				let explanation = '';

				for (let i = 1; i < lines.length; i++) {
					const line = lines[i];
					const optMatch = line.match(/^([A-Ea-e])[\.\)]\s*(.*)/);
					const keyMatch = line.match(/^(?:Kunci|Jawaban|Ans|Key)\s*[:=]\s*(.*)/i);
					const expMatch = line.match(/^(?:Pembahasan|Penjelasan|Exp)\s*[:=]\s*(.*)/i);

					if (optMatch) {
						options.push(optMatch[2]);
					} else if (keyMatch) {
						answer = keyMatch[1];
					} else if (expMatch) {
						explanation = expMatch[1];
					} else {
						if (options.length === 0 && !answer) {
							qText += ' ' + line;
						} else if (explanation) {
							explanation += ' ' + line;
						}
					}
				}

				if (answer.length === 1 && /^[A-E]$/i.test(answer)) {
					const optIndex = answer.toUpperCase().charCodeAt(0) - 65;
					if (options[optIndex]) {
						answer = options[optIndex];
					}
				}

				if (qText) {
					parsedQuestions.push({
						id: startId++,
						topic,
						grade,
						question: qText,
						options: options.length > 0 ? options : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
						answer: answer || (options[0] || 'Opsi A'),
						explanation: explanation || '',
						points: 10
					});
				}
			});

			if (parsedQuestions.length > 0) {
				const combined = [...questionsList, ...parsedQuestions];
				onUpdatePackage(currentPkg.id, { questions: combined });
				setBulkSuccessMsg(`Berhasil menambahkan ${parsedQuestions.length} soal baru ke paket ${currentPkg.name}!`);
				setBulkText('');
				setTimeout(() => {
					setBulkSuccessMsg('');
					setActiveTab('list');
				}, 1800);
			} else {
				alert('Format teks tidak terbaca. Pastikan terdapat nomor soal (1., 2.) dan opsi pilihan (A., B.).');
			}
		} catch (err) {
			console.error('Error parsing bulk text:', err);
			alert('Terjadi kesalahan saat memproses teks.');
		}
	};

	// Save New Package with Grade & Topic metadata
	const handleCreateNewPackage = (e) => {
		e.preventDefault();
		if (!newPkgForm.name.trim()) return;
		soundFX.playCorrect();

		const newId = `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
		const newPackage = {
			id: newId,
			name: newPkgForm.name,
			subject: newPkgForm.subject,
			grade: newPkgForm.grade || 'Kelas XII',
			materi: newPkgForm.materi || newPkgForm.name,
			icon: newPkgForm.icon || '📚',
			gameTitle: newPkgForm.gameTitle || `${newPkgForm.name.toUpperCase()} CHAMPION`,
			tagline: newPkgForm.tagline || 'Think Fast. Solve Smart. Become the Champion!',
			questions: []
		};

		onCreatePackage(newPackage);
		setSelectedPkgId(newId);
		setActiveTab('list');
		setNewPkgForm({
			name: '',
			subject: 'Biologi',
			grade: 'Kelas XII',
			materi: '',
			icon: '🧬',
			gameTitle: 'ARENA OF CHAMPION',
			tagline: 'Think Fast. Solve Smart. Become the Champion!'
		});
	};

	// Export Current Package as JSON
	const handleExportJSON = () => {
		soundFX.playClick();
		const dataStr = JSON.stringify(currentPkg, null, 2);
		const blob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `Bank_Soal_${currentPkg.name.replace(/\s+/g, '_')}.json`;
		link.click();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
			<div className="relative w-full max-w-5xl bg-[#0F172A] border-2 border-cyan-500/50 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden flex flex-col text-slate-100 max-h-[92vh]">
				
				{/* Top Header */}
				<div className="bg-gradient-to-r from-slate-900 via-[#1E293B] to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-inner">
							<BookOpen className="w-6 h-6" />
						</div>
						<div>
							<h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
								Bank Soal Berdasarkan Mapel, Tingkat Kelas & Bab Materi
							</h3>
							<p className="text-xs text-slate-400">
								Kelola dan siapkan paket soal spesifik per bab (contoh: Biologi XII Bab Genetika, Kimia XI Termokimia)
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

				{/* Filter Toolbar for Packages (Mapel & Grade) */}
				<div className="bg-slate-950 px-6 py-2.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-slate-400 font-bold flex items-center gap-1">
							<Filter className="w-3.5 h-3.5 text-cyan-400" /> Filter Paket:
						</span>

						{/* Subject Filter */}
						<select
							value={filterSubject}
							onChange={(e) => setFilterSubject(e.target.value)}
							className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-bold focus:outline-none focus:border-cyan-400"
						>
							<option value="all">Semua Mapel</option>
							{uniqueSubjects.filter((s) => s !== 'all').map((subj) => (
								<option key={subj} value={subj}>
									Mapel {subj}
								</option>
							))}
						</select>

						{/* Grade Filter */}
						<select
							value={filterGrade}
							onChange={(e) => setFilterGrade(e.target.value)}
							className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 font-bold focus:outline-none focus:border-cyan-400"
						>
							<option value="all">Semua Tingkat Kelas</option>
							<option value="Kelas 7">Kelas 7</option>
							<option value="Kelas 8">Kelas 8</option>
							<option value="Kelas 9">Kelas 9</option>
							<option value="Kelas 10">Kelas 10</option>
							<option value="Kelas 11">Kelas 11</option>
							<option value="Kelas 12">Kelas 12</option>
						</select>
					</div>

					<div className="flex items-center gap-2">
						{onSyncToDb && (
							<button
								type="button"
								onClick={async () => {
									setSyncing(true);
									try {
										await onSyncToDb();
									} finally {
										setSyncing(false);
									}
								}}
								disabled={syncing}
								className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
								title="Unggah dan simpan seluruh bank soal ke database Supabase agar sinkron di semua perangkat"
							>
								<Upload className={`w-3.5 h-3.5 ${syncing ? 'animate-bounce' : ''}`} />
								<span>{syncing ? 'Menyinkronkan...' : '☁️ Sinkronkan ke Supabase'}</span>
							</button>
						)}

						<button
							onClick={() => setActiveTab('new_package')}
							className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-md cursor-pointer"
						>
							<Plus className="w-4 h-4" /> + Buat Paket Bab / Materi Baru
						</button>
					</div>
				</div>

				{/* Package Selector Cards Bar (No overflow scroll clipping) */}
				<div className="bg-slate-950/90 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center gap-2.5">
					{filteredPackages.map((pkg) => (
						<button
							key={pkg.id}
							onClick={() => {
								soundFX.playClick();
								setSelectedPkgId(pkg.id);
								setActiveTab('list');
							}}
							className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border text-left cursor-pointer ${
								selectedPkgId === pkg.id
									? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
									: 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
							}`}
						>
							<span className="text-base">{pkg.icon || '📚'}</span>
							<div className="flex flex-col">
								<span className="font-black uppercase tracking-wider truncate max-w-[200px]">
									{pkg.name}
								</span>
								<span className={`text-[10px] ${selectedPkgId === pkg.id ? 'text-black/80' : 'text-slate-400'}`}>
									{pkg.grade || 'Umum'} • {pkg.questions?.length || 0} Soal
								</span>
							</div>
						</button>
					))}

					{filteredPackages.length === 0 && (
						<p className="text-xs text-slate-500 italic py-1">
							Tidak ada paket soal yang cocok dengan filter mapel/tingkat.
						</p>
					)}
				</div>

				{/* Secondary Action Bar (Tabs & Search) */}
				<div className="px-6 py-3 bg-slate-900/80 border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
					
					{/* Action Buttons */}
					<div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
						<button
							onClick={() => setActiveTab('list')}
							className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
								activeTab === 'list' ? 'bg-slate-800 text-cyan-300 border border-slate-700' : 'text-slate-400 hover:text-slate-200'
							}`}
						>
							Daftar Soal ({questionsList.length})
						</button>

						<button
							onClick={handleStartAddManual}
							className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
								activeTab === 'add_manual' ? 'bg-cyan-500 text-black font-black' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
							}`}
						>
							<Plus className="w-3.5 h-3.5" /> Input Soal Manual
						</button>

						<button
							onClick={() => setActiveTab('bulk_import')}
							className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
								activeTab === 'bulk_import' ? 'bg-emerald-500 text-black font-black' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
							}`}
						>
							<FileText className="w-3.5 h-3.5" /> Impor Teks Sekaligus
						</button>
					</div>

					{/* Search & Export */}
					<div className="flex items-center gap-2 w-full sm:w-auto">
						{activeTab === 'list' && (
							<div className="relative flex-1 sm:w-56">
								<Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
								<input
									type="text"
									placeholder="Cari materi / pertanyaan..."
									value={searchTerm}
									onChange={(e) => setSearchTerm(e.target.value)}
									className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
								/>
							</div>
						)}

						<button
							onClick={handleExportJSON}
							className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
							title="Ekspor Bank Soal ke File JSON"
						>
							<Download className="w-4 h-4" />
						</button>
					</div>

				</div>

				{/* Body Content by Tab */}
				<div className="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
					
					{/* TAB 1: LIST OF QUESTIONS */}
					{activeTab === 'list' && (
						<div className="space-y-4">
							{packages.length === 0 ? (
								<div className="text-center py-16 px-4 bg-slate-950/60 border border-slate-800 rounded-3xl space-y-4 animate-in fade-in">
									<div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
										<BookOpen className="w-8 h-8" />
									</div>
									<div>
										<h4 className="text-base font-black uppercase text-white">Belum Ada Paket Bank Soal</h4>
										<p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
											Buat paket mata pelajaran dan bab pertama Anda untuk menambahkan butir soal kuis.
										</p>
									</div>
									<button
										type="button"
										onClick={() => setActiveTab('new_package')}
										className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition cursor-pointer shadow-md"
									>
										+ Buat Paket Bab / Materi Baru
									</button>
								</div>
							) : (
								<>
									{/* Current Package Overview Banner */}
									{currentPkg && (
										<div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
											<div className="space-y-0.5">
												<div className="flex items-center gap-2">
													<span className="text-base">{currentPkg.icon || '📚'}</span>
													<strong className="text-white font-black text-sm uppercase">{currentPkg.name}</strong>
													<span className="bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded border border-cyan-800 font-bold text-[10px]">
														{currentPkg.grade || 'Semua Tingkat'}
													</span>
												</div>
												{currentPkg.materi && (
													<p className="text-slate-400 text-[11px]">
														Materi / Bab Pokok: <strong className="text-slate-300">{currentPkg.materi}</strong>
													</p>
												)}
											</div>

											<div className="flex items-center gap-2">
												<button
													onClick={() => onDeletePackage && onDeletePackage(currentPkg.id)}
													className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
												>
													<Trash2 className="w-3 h-3" /> Hapus Paket
												</button>
											</div>
										</div>
									)}

									{/* Questions List */}
									{filteredQuestions.length > 0 ? (
										<div className="space-y-2.5">
											{filteredQuestions.map((q) => (
												<div
													key={q.id}
													className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-slate-600 transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
												>
													<div className="space-y-1.5 flex-1">
														<div className="flex items-center gap-2 flex-wrap">
															<span className="font-mono font-bold text-xs bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-800">
																#{q.id}
															</span>
															<span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-800 flex items-center gap-1">
																<Tag className="w-3 h-3 text-cyan-400" />
																{q.topic || 'Umum'}
															</span>
															{q.grade && (
																<span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
																	{q.grade}
																</span>
															)}
															<span className="text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-800">
																Kunci: {q.answer}
															</span>
														</div>

														<p className="text-sm font-medium text-slate-100 leading-relaxed">
															{q.question}
														</p>

														{q.options && q.options.length > 0 && (
															<div className="flex flex-wrap gap-2 pt-1 text-xs text-slate-400">
																{q.options.map((opt, oIdx) => (
																	<span
																		key={oIdx}
																		className={`px-2 py-0.5 rounded-md border text-[11px] ${
																			opt === q.answer
																				? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 font-bold'
																				: 'bg-slate-900 border-slate-800 text-slate-300'
																		}`}
																	>
																		{String.fromCharCode(65 + oIdx)}. {opt}
																	</span>
																))}
															</div>
														)}
													</div>

													{/* Action Buttons */}
													<div className="flex items-center gap-2 shrink-0 self-end md:self-center">
														<button
															onClick={() => handleStartEdit(q)}
															className="p-2 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 transition"
															title="Edit Soal"
														>
															<Edit3 className="w-4 h-4" />
														</button>

														<button
															onClick={() => handleDeleteQuestion(q.id)}
															className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
															title="Hapus Soal"
														>
															<Trash2 className="w-4 h-4" />
														</button>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="py-12 text-center text-slate-400 space-y-3">
											<BookOpen className="w-10 h-10 mx-auto text-slate-600" />
											<p className="text-sm font-bold">Belum ada soal pada paket ini.</p>
											<div className="flex items-center justify-center gap-3">
												<button
													onClick={handleStartAddManual}
													className="px-4 py-2 rounded-xl bg-cyan-500 text-black font-bold text-xs"
												>
													+ Input Soal Manual
												</button>
												<button
													onClick={() => setActiveTab('bulk_import')}
													className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs"
												>
													Impor Teks Sekaligus
												</button>
											</div>
										</div>
									)}
								</>
							)}
						</div>
					)}

					{/* TAB 2: ADD / EDIT MANUAL */}
					{activeTab === 'add_manual' && (
						<form onSubmit={handleSaveSingleQuestion} className="space-y-4 max-w-2xl mx-auto">
							<div className="flex items-center justify-between border-b border-slate-800 pb-2">
								<h4 className="text-sm font-black uppercase text-cyan-400">
									{editingQuestionId ? `Edit Soal #${editingQuestionId}` : 'Tambah Soal Baru'}
								</h4>
								<button
									type="button"
									onClick={() => setActiveTab('list')}
									className="text-xs text-slate-400 hover:text-white"
								>
									Batal
								</button>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Topik / Bab Materi <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="Contoh: Genetika / Termokimia"
										value={singleForm.topic}
										onChange={(e) => setSingleForm({ ...singleForm, topic: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>

								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Tingkat Kelas
									</label>
									<select
										value={singleForm.grade}
										onChange={(e) => setSingleForm({ ...singleForm, grade: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-bold"
									>
										<option value="Kelas 7">Kelas 7</option>
										<option value="Kelas 8">Kelas 8</option>
										<option value="Kelas 9">Kelas 9</option>
										<option value="Kelas 10">Kelas 10</option>
										<option value="Kelas 11">Kelas 11</option>
										<option value="Kelas 12">Kelas 12</option>
										<option value="Semua Tingkat">Semua Tingkat</option>
									</select>
								</div>

								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Bobot Poin
									</label>
									<input
										type="number"
										value={singleForm.points}
										onChange={(e) => setSingleForm({ ...singleForm, points: Number(e.target.value) })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>
							</div>

							<div>
								<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
									Pertanyaan Soal <span className="text-rose-400">*</span>
								</label>
								<textarea
									rows={3}
									required
									placeholder="Tuliskan pertanyaan kuis di sini..."
									value={singleForm.question}
									onChange={(e) => setSingleForm({ ...singleForm, question: e.target.value })}
									className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-400"
								/>
							</div>

							{/* Options A, B, C, D */}
							<div className="space-y-2">
								<label className="block text-[11px] uppercase font-bold text-slate-400">
									Pilihan Jawaban (A, B, C, D)
								</label>
								{singleForm.options.map((opt, idx) => (
									<div key={idx} className="flex items-center gap-2">
										<span className="w-6 h-6 rounded-lg bg-slate-800 text-cyan-400 font-bold flex items-center justify-center text-xs shrink-0">
											{String.fromCharCode(65 + idx)}
										</span>
										<input
											type="text"
											placeholder={`Pilihan ${String.fromCharCode(65 + idx)}`}
											value={opt}
											onChange={(e) => {
												const copy = [...singleForm.options];
												copy[idx] = e.target.value;
												setSingleForm({ ...singleForm, options: copy });
											}}
											className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
										/>
									</div>
								))}
							</div>

							{/* Answer & Explanation */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label className="block text-[11px] uppercase font-bold text-emerald-400 mb-1">
										Kunci Jawaban Tepat <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="Ketik teks jawaban atau pilih opsi..."
										value={singleForm.answer}
										onChange={(e) => setSingleForm({ ...singleForm, answer: e.target.value })}
										className="w-full bg-emerald-950/40 border border-emerald-600 rounded-xl px-3 py-2 text-xs text-emerald-200 font-bold focus:outline-none focus:border-emerald-400"
									/>
								</div>

								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Pembahasan / Penjelasan (Opsional)
									</label>
									<input
										type="text"
										placeholder="Penjelasan singkat untuk guru..."
										value={singleForm.explanation}
										onChange={(e) => setSingleForm({ ...singleForm, explanation: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>
							</div>

							<div className="flex items-center justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setActiveTab('list')}
									className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
								>
									Batal
								</button>
								<button
									type="submit"
									className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition"
								>
									{editingQuestionId ? 'Simpan Perubahan' : 'Tambah Soal'}
								</button>
							</div>
						</form>
					)}

					{/* TAB 3: BULK IMPORT TEXT */}
					{activeTab === 'bulk_import' && (
						<div className="space-y-4 max-w-3xl mx-auto">
							<div className="flex items-center justify-between border-b border-slate-800 pb-2">
								<h4 className="text-sm font-black uppercase text-emerald-400 flex items-center gap-2">
									<FileText className="w-4 h-4" />
									Impor Cepat Puluhan Soal dari Teks
								</h4>
								<button
									type="button"
									onClick={() => setActiveTab('list')}
									className="text-xs text-slate-400 hover:text-white"
								>
									Kembali
								</button>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Bab / Topik Bawaan Batch Ini:
									</label>
									<input
										type="text"
										value={bulkDefaultTopic}
										onChange={(e) => setBulkDefaultTopic(e.target.value)}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>

								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Tingkat Kelas:
									</label>
									<select
										value={bulkDefaultGrade}
										onChange={(e) => setBulkDefaultGrade(e.target.value)}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-bold"
									>
										<option value="Kelas 7">Kelas 7</option>
										<option value="Kelas 8">Kelas 8</option>
										<option value="Kelas 9">Kelas 9</option>
										<option value="Kelas 10">Kelas 10</option>
										<option value="Kelas 11">Kelas 11</option>
										<option value="Kelas 12">Kelas 12</option>
										<option value="Semua Tingkat">Semua Tingkat</option>
									</select>
								</div>
							</div>

							<div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
								<p className="font-bold text-slate-200">Format yang didukung (Salin & Tempel dari Word/Notepad):</p>
								<pre className="text-[11px] bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-cyan-300 font-mono">
{`1. [Genetika] Basa nitrogen yang menggantikan Timin pada RNA adalah...
A. Urasil
B. Adenin
C. Guanin
D. Sitosin
Kunci: A
Pembahasan: RNA memiliki basa Urasil...

2. [Metabolisme] Tahap glikolisis terjadi di...
A. Sitosol
B. Mitokondria
Kunci: A`}
								</pre>
							</div>

							<textarea
								rows={7}
								placeholder="Tempel teks soal di sini..."
								value={bulkText}
								onChange={(e) => setBulkText(e.target.value)}
								className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-xs text-slate-100 font-mono focus:outline-none focus:border-cyan-400 custom-scrollbar"
							/>

							{bulkSuccessMsg && (
								<div className="p-3 bg-emerald-950/80 border border-emerald-500 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
									<CheckCircle className="w-4 h-4" /> {bulkSuccessMsg}
								</div>
							)}

							<div className="flex items-center justify-between pt-2">
								<button
									type="button"
									onClick={() => setActiveTab('list')}
									className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
								>
									Batal
								</button>

								<button
									type="button"
									onClick={handleProcessBulkImport}
									className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg"
								>
									<CheckCircle className="w-4 h-4" /> Proses & Masukkan Soal
								</button>
							</div>
						</div>
					)}

					{/* TAB 4: CREATE NEW PACKAGE (Specific Subject, Grade & Chapter) */}
					{activeTab === 'new_package' && (
						<form onSubmit={handleCreateNewPackage} className="space-y-4 max-w-xl mx-auto">
							<div className="border-b border-slate-800 pb-2">
								<h4 className="text-sm font-black uppercase text-cyan-400">
									Buat Paket Bank Soal Bab / Materi Spesifik
								</h4>
								<p className="text-xs text-slate-400">
									Tentukan mata pelajaran, tingkat kelas (7, 8, 9, 10, 11, 12), dan topik materi pokok
								</p>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Nama Paket Soal <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="Contoh: Biologi 12 - Bab Genetika / IPA 7 Sel"
										value={newPkgForm.name}
										onChange={(e) => setNewPkgForm({ ...newPkgForm, name: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-bold"
									/>
								</div>

								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Mata Pelajaran <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="Contoh: Biologi / IPA / Fisika / Matematika"
										value={newPkgForm.subject}
										onChange={(e) => setNewPkgForm({ ...newPkgForm, subject: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Tingkat Kelas
									</label>
									<select
										value={newPkgForm.grade}
										onChange={(e) => setNewPkgForm({ ...newPkgForm, grade: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-bold"
									>
										<option value="Kelas 7">Kelas 7</option>
										<option value="Kelas 8">Kelas 8</option>
										<option value="Kelas 9">Kelas 9</option>
										<option value="Kelas 10">Kelas 10</option>
										<option value="Kelas 11">Kelas 11</option>
										<option value="Kelas 12">Kelas 12</option>
										<option value="Semua Tingkat">Semua Tingkat</option>
									</select>
								</div>

								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Materi / Bab Pokok
									</label>
									<input
										type="text"
										placeholder="Contoh: Genetika & Pola Hereditas"
										value={newPkgForm.materi}
										onChange={(e) => setNewPkgForm({ ...newPkgForm, materi: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Judul Arena Game
									</label>
									<input
										type="text"
										placeholder="BIOLOGY OF CHAMPION"
										value={newPkgForm.gameTitle}
										onChange={(e) => setNewPkgForm({ ...newPkgForm, gameTitle: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>

								<div>
									<label className="block text-[11px] uppercase font-bold text-slate-400 mb-1">
										Ikon Emoji
									</label>
									<input
										type="text"
										placeholder="🧬 / 🧪 / ⚛️ / 📐"
										value={newPkgForm.icon}
										onChange={(e) => setNewPkgForm({ ...newPkgForm, icon: e.target.value })}
										className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>
							</div>

							<div className="flex items-center justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setActiveTab('list')}
									className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
								>
									Batal
								</button>
								<button
									type="submit"
									className="px-6 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition shadow-md"
								>
									Buat Paket Soal
								</button>
							</div>
						</form>
					)}

				</div>

				{/* Footer */}
				<div className="bg-slate-900 px-6 py-3.5 border-t border-slate-800 flex items-center justify-between">
					<span className="text-xs text-slate-400">
						Paket Aktif: <strong className="text-cyan-300">{currentPkg?.name}</strong> ({questionsList.length} Soal) • <span className="text-slate-300">{currentPkg?.grade || 'Semua Kelas'}</span>
					</span>

					<div className="flex items-center gap-3">
						<button
							onClick={() => {
								onSelectPackage(currentPkg.id);
								onClose();
							}}
							className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider transition shadow-md"
						>
							Pilih Paket Ini & Tutup
						</button>
					</div>
				</div>

			</div>
		</div>
	);
}
