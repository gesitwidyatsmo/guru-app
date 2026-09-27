"use client";
import React, { useState, useEffect } from 'react';
import { 
	X, 
	FlaskConical, 
	Users, 
	Sparkles, 
	Shuffle, 
	Plus, 
	Trash2, 
	CheckCircle, 
	GraduationCap, 
	UserCheck, 
	UserX,
	ArrowRight,
	BookOpen,
	RefreshCw,
	Tag,
	Filter,
	Sliders,
	FileText,
	CheckSquare,
	Square
} from 'lucide-react';
import { soundFX } from '../utils/audio';

const DEFAULT_TEAM_COLORS = [
	{ name: 'MERAH', color: '#EF4444' },
	{ name: 'KUNING', color: '#FACC15' },
	{ name: 'PINK', color: '#EC4899' },
	{ name: 'HIJAU', color: '#10B981' },
	{ name: 'UNGU', color: '#A855F7' },
	{ name: 'ORANGE', color: '#F97316' },
	{ name: 'CYAN', color: '#06B6D4' },
	{ name: 'BIRU', color: '#3B82F6' },
	{ name: 'EMERALD', color: '#059669' },
	{ name: 'AMBER', color: '#D97706' },
	{ name: 'INDIGO', color: '#6366F1' },
	{ name: 'LIME', color: '#84CC16' },
];

export default function CreateGameModal({ 
	packages = [], 
	onOpenBankManager, 
	onClose, 
	onCreateGame 
}) {
	const [step, setStep] = useState(1); // 1: Info Dasar & Soal, 2: Pembagian Kelompok & Siswa
	const [loadingClasses, setLoadingClasses] = useState(false);
	const [classList, setClassList] = useState([]);
	const [fetchingSiswa, setFetchingSiswa] = useState(false);
	
	// Student Roster & Attendance
	const [availableSiswa, setAvailableSiswa] = useState([]);
	const [presentStudents, setPresentStudents] = useState(() => new Set());
	const [manualStudentsText, setManualStudentsText] = useState('');
	const [showManualStudentBoxInStep2, setShowManualStudentBoxInStep2] = useState(false);
	const [showAttendancePanel, setShowAttendancePanel] = useState(true);

	// Selected Question Package
	const [selectedPackageId, setSelectedPackageId] = useState(packages[0]?.id || 'kimia_xii');

	// Form State
	const [formData, setFormData] = useState({
		gameTitle: 'CHEMISTRY OF CHAMPION',
		subTitle: "Mrs Nunung's Chemistry Class (Kelas 12)",
		tagline: 'Think Fast. Solve Smart. Become the Champion!',
		teacherName: 'Mrs Nunung',
		className: 'XII IPA 1',
		totalQuestions: 100, // 25, 50, 100 or custom
		teamCount: 6, // 2 - 12 or custom
	});

	// Custom Toggles for Questions, Teams & Class
	const [isCustomQuestions, setIsCustomQuestions] = useState(false);
	const [isCustomTeams, setIsCustomTeams] = useState(false);
	const [isCustomClass, setIsCustomClass] = useState(false);

	// Filter Mapel in Create Form
	const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');

	// Teams State with Students list
	const [teams, setTeams] = useState(() => {
		return DEFAULT_TEAM_COLORS.slice(0, 6).map((t, idx) => ({
			id: `team_${idx + 1}`,
			name: t.name,
			color: t.color,
			score: 0,
			students: []
		}));
	});

	// Temporary input text for each team's students (comma or newline separated)
	const [studentInputs, setStudentInputs] = useState(() => ({
		0: '', 1: '', 2: '', 3: '', 4: '', 5: ''
	}));

	// Fetch Classes from DB on mount
	useEffect(() => {
		async function fetchClasses() {
			try {
				setLoadingClasses(true);
				const res = await fetch('/api/kelas');
				if (res.ok) {
					const data = await res.json();
					if (Array.isArray(data) && data.length > 0) {
						setClassList(data);
						if (data[0]?.kelas) {
							setFormData(prev => ({ ...prev, className: data[0].kelas }));
							fetchStudentsForClass(data[0].kelas);
						}
					}
				}
			} catch (err) {
				console.error('Error fetching classes:', err);
			} finally {
				setLoadingClasses(false);
			}
		}
		fetchClasses();
	}, []);

	// When package selection changes, update game title and tagline presets
	const handlePackageChange = (pkgId) => {
		setSelectedPackageId(pkgId);
		const found = packages.find(p => p.id === pkgId);
		if (found) {
			setFormData(prev => ({
				...prev,
				gameTitle: found.gameTitle || `${found.name.toUpperCase()} OF CHAMPION`,
				tagline: found.tagline || prev.tagline,
				subTitle: found.subTitle || `${found.name} (${found.grade || prev.className})`,
				totalQuestions: isCustomQuestions ? prev.totalQuestions : Math.min(prev.totalQuestions, found.questions?.length > 25 ? prev.totalQuestions : 25)
			}));
		}
	};

	// Fetch Students when class changes from DB
	const fetchStudentsForClass = async (targetClass) => {
		if (!targetClass) return;
		try {
			setFetchingSiswa(true);
			const res = await fetch(`/api/siswa?kelas=${encodeURIComponent(targetClass)}`);
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data)) {
					const names = data.map(s => s.nama_lengkap);
					setAvailableSiswa(names);
					setPresentStudents(new Set(names));
					setManualStudentsText(names.join('\n'));
				}
			}
		} catch (err) {
			console.error('Error fetching students:', err);
		} finally {
			setFetchingSiswa(false);
		}
	};

	// Handle manual students bulk input
	const handleManualStudentsChange = (text) => {
		setManualStudentsText(text);
		const parsed = text
			.split(/[\n,]+/)
			.map(s => s.trim())
			.filter(s => s.length > 0);
		setAvailableSiswa(parsed);
		setPresentStudents(new Set(parsed));
	};

	// Toggle individual student attendance
	const toggleStudentAttendance = (studentName) => {
		soundFX.playClick();
		setPresentStudents(prev => {
			const next = new Set(prev);
			if (next.has(studentName)) {
				next.delete(studentName);
			} else {
				next.add(studentName);
			}
			return next;
		});
	};

	// Set All Attendance (Check All / Uncheck All)
	const handleSetAllAttendance = (allPresent) => {
		soundFX.playClick();
		if (allPresent) {
			setPresentStudents(new Set(availableSiswa));
		} else {
			setPresentStudents(new Set());
		}
	};

	// Handle team count change (2 to 12)
	const handleTeamCountChange = (count) => {
		const parsed = Number(count);
		if (isNaN(parsed) || parsed < 1) return;
		const newCount = Math.max(2, Math.min(12, parsed));
		setFormData(prev => ({ ...prev, teamCount: newCount }));

		setTeams(prevTeams => {
			const updated = [];
			for (let i = 0; i < newCount; i++) {
				if (prevTeams[i]) {
					updated.push(prevTeams[i]);
				} else {
					const preset = DEFAULT_TEAM_COLORS[i] || { name: `TIM ${i + 1}`, color: '#38BDF8' };
					updated.push({
						id: `team_${i + 1}`,
						name: preset.name,
						color: preset.color,
						score: 0,
						students: []
					});
				}
			}
			return updated;
		});
	};

	// Auto-distribute ONLY PRESENT (checked) students evenly across teams
	const handleAutoDistributeStudents = () => {
		soundFX.playClick();
		const activeStudents = availableSiswa.filter(s => presentStudents.has(s));

		if (activeStudents.length === 0) {
			alert('Tidak ada siswa yang berstatus Hadir (diceklis). Harap centang minimal 1 siswa yang hadir untuk dibagi ke kelompok.');
			return;
		}

		const shuffled = [...activeStudents].sort(() => Math.random() - 0.5);
		const newTeams = teams.map(t => ({ ...t, students: [] }));

		shuffled.forEach((studentName, index) => {
			const teamIndex = index % newTeams.length;
			newTeams[teamIndex].students.push(studentName);
		});

		setTeams(newTeams);

		const newInputs = {};
		newTeams.forEach((t, idx) => {
			newInputs[idx] = t.students.join(', ');
		});
		setStudentInputs(newInputs);
	};

	// Update team field (name / color)
	const handleTeamFieldChange = (index, field, value) => {
		setTeams(prev => {
			const copy = [...prev];
			copy[index] = { ...copy[index], [field]: value };
			return copy;
		});
	};

	// Update student input for a single team
	const handleStudentInputChange = (index, text) => {
		setStudentInputs(prev => ({ ...prev, [index]: text }));
		const parsedList = text
			.split(/[\n,]+/)
			.map(s => s.trim())
			.filter(s => s.length > 0);

		setTeams(prev => {
			const copy = [...prev];
			copy[index] = { ...copy[index], students: parsedList };
			return copy;
		});
	};

	// Submit and create game
	const handleSubmit = (e) => {
		e.preventDefault();
		soundFX.playCorrect();

		const chosenPkg = packages.find(p => p.id === selectedPackageId) || packages[0];
		const totalStudents = teams.reduce((acc, t) => acc + (t.students?.length || 0), 0);

		const newGameSession = {
			id: `game_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
			createdAt: new Date().toISOString(),
			packageId: selectedPackageId,
			packageName: chosenPkg?.name || 'Kimia',
			subject: chosenPkg?.subject || 'Umum',
			grade: chosenPkg?.grade || 'Kelas 12',
			materi: chosenPkg?.materi || '',
			config: {
				gameTitle: formData.gameTitle,
				subTitle: formData.subTitle,
				tagline: formData.tagline,
				className: formData.className,
				teacherName: formData.teacherName,
			},
			totalQuestions: formData.totalQuestions,
			teams: teams.map(t => ({
				...t,
				score: 0
			})),
			tileStates: {},
			arenaSeconds: 0,
			gameStatus: 'idle',
			totalStudents,
			lastPlayed: new Date().toISOString(),
		};

		onCreateGame(newGameSession);
	};

	// Filtered packages by chosen subject filter
	const displayPackages = packages.filter((p) => {
		if (selectedSubjectFilter !== 'all' && p.subject?.toLowerCase() !== selectedSubjectFilter.toLowerCase()) return false;
		return true;
	});

	const uniqueSubjects = ['all', ...new Set(packages.map((p) => p.subject || 'Umum'))];
	const presentCount = presentStudents.size;
	const absentCount = Math.max(0, availableSiswa.length - presentCount);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
			<div className="relative w-full max-w-4xl bg-[#0F172A] border-2 border-cyan-500/50 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.3)] overflow-hidden flex flex-col text-slate-100 max-h-[92vh]">
				
				{/* Top Header */}
				<div className="bg-gradient-to-r from-slate-900 via-[#1E293B] to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="p-2.5 rounded-2xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-inner">
							<FlaskConical className="w-6 h-6" />
						</div>
						<div>
							<h3 className="text-lg sm:text-xl font-black uppercase tracking-wider text-white flex items-center gap-2">
								Buat Arena Champion Baru
								<span className="text-xs font-mono font-bold bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-800">
									Langkah {step} dari 2
								</span>
							</h3>
							<p className="text-xs text-slate-400">
								Pilih mata pelajaran, kelas, bank soal, dan presensi anggota tim siswa
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

				{/* Step Indicators */}
				<div className="flex border-b border-slate-800 bg-slate-950/60 px-6 py-2 gap-4">
					<button
						type="button"
						onClick={() => setStep(1)}
						className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider py-1.5 border-b-2 transition ${
							step === 1 ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400'
						}`}
					>
						<span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[10px]">1</span>
						Mata Pelajaran, Kelas & Siswa
					</button>

					<button
						type="button"
						onClick={() => setStep(2)}
						className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider py-1.5 border-b-2 transition ${
							step === 2 ? 'border-cyan-400 text-cyan-400' : 'border-transparent text-slate-400'
						}`}
					>
						<span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-700 flex items-center justify-center text-[10px]">2</span>
						Presensi & Pembagian Kelompok ({teams.length} Tim)
					</button>
				</div>

				{/* Form Body */}
				<form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
					
					{/* STEP 1: INFO DASAR & PILIHAN MAPEL / BANK SOAL */}
					{step === 1 && (
						<div className="space-y-5 animate-in fade-in duration-150">
							
							{/* MAPEL & BAB MATERI SELECTOR */}
							<div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="flex items-center gap-2">
										<label className="text-xs uppercase font-black tracking-wider text-cyan-300 flex items-center gap-1.5">
											<BookOpen className="w-4 h-4" />
											Pilih Paket Soal & Materi:
										</label>

										{/* Quick Subject Filter Pill */}
										<div className="flex items-center gap-1">
											{uniqueSubjects.map((s) => (
												<button
													key={s}
													type="button"
													onClick={() => setSelectedSubjectFilter(s)}
													className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase transition ${
														selectedSubjectFilter === s
															? 'bg-cyan-500 text-black font-black'
															: 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
													}`}
												>
													{s === 'all' ? 'Semua' : s}
												</button>
											))}
										</div>
									</div>

									{onOpenBankManager && (
										<button
											type="button"
											onClick={onOpenBankManager}
											className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 bg-slate-900 px-3 py-1 rounded-lg border border-cyan-800 flex items-center gap-1.5 hover:bg-slate-800 transition cursor-pointer"
										>
											<Plus className="w-3.5 h-3.5" />
											<span>Kelola / Buat Paket Bab Baru</span>
										</button>
									)}
								</div>

								{/* Packages Grid */}
								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
									{displayPackages.map((pkg) => (
										<button
											key={pkg.id}
											type="button"
											onClick={() => handlePackageChange(pkg.id)}
											className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
												selectedPackageId === pkg.id
													? 'bg-cyan-500 text-black border-cyan-300 font-black shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-102'
													: 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
											}`}
										>
											<div className="flex items-center justify-between mb-1.5">
												<span className="text-xl">{pkg.icon || '📚'}</span>
												<div className="flex items-center gap-1">
													<span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
														selectedPackageId === pkg.id ? 'bg-black/25 text-black' : 'bg-slate-800 text-cyan-400 border border-slate-700'
													}`}>
														{pkg.grade || 'Umum'}
													</span>
													<span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
														selectedPackageId === pkg.id ? 'bg-black text-cyan-300' : 'bg-slate-800 text-slate-400'
													}`}>
														{pkg.questions?.length || 0} Soal
													</span>
												</div>
											</div>

											<span className="text-xs uppercase font-black block truncate">
												{pkg.name}
											</span>

											{pkg.materi && (
												<span className={`text-[10px] line-clamp-1 mt-0.5 ${
													selectedPackageId === pkg.id ? 'text-black/80' : 'text-slate-400'
												}`}>
													Materi: {pkg.materi}
												</span>
											)}
										</button>
									))}

									{displayPackages.length === 0 && (
										<div className="col-span-full p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
											<p className="text-xs text-slate-400">Belum ada paket bank soal di sistem.</p>
											{onOpenBankManager && (
												<button
													type="button"
													onClick={onOpenBankManager}
													className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider transition cursor-pointer"
												>
													+ Buat Paket Bab Baru
												</button>
											)}
										</div>
									)}
								</div>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								
								{/* Nama Guru */}
								<div>
									<label className="block text-xs uppercase font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
										<GraduationCap className="w-4 h-4 text-cyan-400" />
										Nama Guru / Game Master <span className="text-rose-400">*</span>
									</label>
									<input
										type="text"
										required
										placeholder="Contoh: Mrs Nunung / Pak Budi"
										value={formData.teacherName}
										onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
										className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-400"
									/>
								</div>

								{/* Pilihan Kelas */}
								<div>
									<label className="block text-xs uppercase font-bold text-slate-300 mb-1.5 flex items-center justify-between">
										<span className="flex items-center gap-1.5">
											<Users className="w-4 h-4 text-cyan-400" />
											Kelas Target <span className="text-rose-400">*</span>
										</span>
										{loadingClasses && <span className="text-[10px] text-cyan-400 animate-pulse">Memuat...</span>}
									</label>

									{isCustomClass || classList.length === 0 ? (
										<div className="flex items-center gap-2">
											<input
												type="text"
												required
												placeholder="Ketik nama kelas (contoh: 7A, 8B, 9C, X-1)..."
												value={formData.className}
												onChange={(e) => {
													const val = e.target.value;
													setFormData({ ...formData, className: val });
													fetchStudentsForClass(val);
												}}
												className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-cyan-400"
											/>
											{classList.length > 0 && (
												<button
													type="button"
													onClick={() => {
														setIsCustomClass(false);
														if (classList[0]?.kelas) {
															setFormData({ ...formData, className: classList[0].kelas });
															fetchStudentsForClass(classList[0].kelas);
														}
													}}
													className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold whitespace-nowrap shrink-0 transition cursor-pointer"
													title="Pilih dari daftar database kelas"
												>
													Pilih List
												</button>
											)}
										</div>
									) : (
										<select
											value={formData.className}
											onChange={(e) => {
												const val = e.target.value;
												if (val === '__custom__') {
													setIsCustomClass(true);
													setFormData({ ...formData, className: '' });
													setAvailableSiswa([]);
													setPresentStudents(new Set());
													setManualStudentsText('');
												} else {
													setFormData({ ...formData, className: val });
													fetchStudentsForClass(val);
												}
											}}
											className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-400 cursor-pointer"
										>
											{classList.map((c) => (
												<option key={c.id || c.kelas} value={c.kelas}>
													{c.kelas} {c.wali_kelas ? `(Wali: ${c.wali_kelas})` : ''}
												</option>
											))}
											<option value="__custom__">✏️ Lainnya / Ketik Manual...</option>
										</select>
									)}
								</div>

								{/* Judul Game */}
								<div>
									<label className="block text-xs uppercase font-bold text-slate-300 mb-1.5">
										Judul Game / Arena
									</label>
									<input
										type="text"
										required
										value={formData.gameTitle}
										onChange={(e) => setFormData({ ...formData, gameTitle: e.target.value })}
										className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-cyan-400"
									/>
								</div>

								{/* Sub Judul */}
								<div>
									<label className="block text-xs uppercase font-bold text-slate-300 mb-1.5">
										Sub Judul / Header Kelas
									</label>
									<input
										type="text"
										value={formData.subTitle}
										onChange={(e) => setFormData({ ...formData, subTitle: e.target.value })}
										className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-cyan-400"
									/>
								</div>

							</div>

							{/* Input Daftar Nama Siswa Manual (muncul saat ketik kelas manual) */}
							{(isCustomClass || classList.length === 0) && (
								<div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-2 animate-in fade-in">
									<div className="flex items-center justify-between">
										<label className="text-xs uppercase font-black tracking-wider text-cyan-300 flex items-center gap-1.5">
											<Users className="w-4 h-4" />
											Input Daftar Siswa Kelas {formData.className || 'Ini'} ({availableSiswa.length} Siswa Terdeteksi)
										</label>
										<span className="text-[10px] text-slate-400">Pisahkan dengan koma atau baris baru</span>
									</div>
									<textarea
										rows={3}
										placeholder="Salin & tempel daftar nama siswa di sini (contoh: Ahmad, Budi, Citra, Doni, Eko, Fani, Gita, Hadi, Indah...)"
										value={manualStudentsText}
										onChange={(e) => handleManualStudentsChange(e.target.value)}
										className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 custom-scrollbar"
									/>
								</div>
							)}

							{/* Slogan */}
							<div>
								<label className="block text-xs uppercase font-bold text-slate-300 mb-1.5">
									Slogan / Tagline
								</label>
								<input
									type="text"
									value={formData.tagline}
									onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
									className="w-full bg-slate-800/90 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-200 italic focus:outline-none focus:border-cyan-400"
								/>
							</div>

							{/* Jumlah Soal & Jumlah Kelompok */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
								
								{/* Jumlah Soal Arena */}
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
											<BookOpen className="w-4 h-4 text-cyan-400" />
											Kapasitas Arena Soal
										</label>
										<span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
											{formData.totalQuestions} Soal
										</span>
									</div>

									{/* Presets + Lainnya */}
									<div className="grid grid-cols-4 gap-2">
										{[25, 50, 100].map((num) => (
											<button
												key={num}
												type="button"
												onClick={() => {
													setIsCustomQuestions(false);
													setFormData({ ...formData, totalQuestions: num });
												}}
												className={`py-2 px-2 rounded-xl font-bold text-xs border transition cursor-pointer ${
													!isCustomQuestions && formData.totalQuestions === num
														? 'bg-cyan-500 text-black border-cyan-400 font-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
														: 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
												}`}
											>
												{num} Soal
											</button>
										))}

										<button
											type="button"
											onClick={() => setIsCustomQuestions(true)}
											className={`py-2 px-2 rounded-xl font-bold text-xs border transition cursor-pointer flex items-center justify-center gap-1 ${
												isCustomQuestions || ![25, 50, 100].includes(formData.totalQuestions)
													? 'bg-cyan-500 text-black border-cyan-400 font-black shadow-[0_0_15px_rgba(6,182,212,0.4)]'
													: 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
											}`}
										>
											<span>Lainnya...</span>
										</button>
									</div>

									{/* Custom Questions Input Field */}
									{(isCustomQuestions || ![25, 50, 100].includes(formData.totalQuestions)) && (
										<div className="pt-1 animate-in fade-in duration-150">
											<div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-cyan-500/50">
												<span className="text-[11px] font-bold text-cyan-300 pl-1 shrink-0">
													Ketik Jumlah Soal:
												</span>
												<input
													type="number"
													min="1"
													max="100"
													value={formData.totalQuestions}
													onChange={(e) => {
														const val = parseInt(e.target.value, 10);
														setFormData({ ...formData, totalQuestions: isNaN(val) ? 1 : Math.max(1, Math.min(100, val)) });
													}}
													className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
												/>
												<span className="text-[11px] text-slate-400 pr-1 shrink-0">(1 - 100)</span>
											</div>
										</div>
									)}
								</div>

								{/* Jumlah Kelompok */}
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<label className="text-xs uppercase font-bold text-slate-300 flex items-center gap-1.5">
											<Users className="w-4 h-4 text-cyan-400" />
											Jumlah Kelompok / Tim
										</label>
										<span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
											{formData.teamCount} Kelompok
										</span>
									</div>

									{/* Presets + Lainnya */}
									<div className="grid grid-cols-6 gap-1.5">
										{[2, 3, 4, 6, 8].map((count) => (
											<button
												key={count}
												type="button"
												onClick={() => {
													setIsCustomTeams(false);
													handleTeamCountChange(count);
												}}
												className={`py-2 rounded-xl font-bold text-xs border transition cursor-pointer ${
													!isCustomTeams && formData.teamCount === count
														? 'bg-cyan-500 text-black border-cyan-400 font-black'
														: 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
												}`}
											>
												{count}
											</button>
										))}

										<button
											type="button"
											onClick={() => setIsCustomTeams(true)}
											className={`py-2 rounded-xl font-bold text-xs border transition cursor-pointer text-center ${
												isCustomTeams || ![2, 3, 4, 6, 8].includes(formData.teamCount)
													? 'bg-cyan-500 text-black border-cyan-400 font-black'
													: 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-slate-600'
											}`}
											title="Kustom jumlah kelompok"
										>
											+
										</button>
									</div>

									{/* Custom Team Count Input Field */}
									{(isCustomTeams || ![2, 3, 4, 6, 8].includes(formData.teamCount)) && (
										<div className="pt-1 animate-in fade-in duration-150">
											<div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-emerald-500/50">
												<span className="text-[11px] font-bold text-emerald-300 pl-1 shrink-0">
													Ketik Jumlah Tim:
												</span>
												<input
													type="number"
													min="2"
													max="12"
													value={formData.teamCount}
													onChange={(e) => handleTeamCountChange(e.target.value)}
													className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
												/>
												<span className="text-[11px] text-slate-400 pr-1 shrink-0">(2 - 12 Tim)</span>
											</div>
										</div>
									)}
								</div>

							</div>

						</div>
					)}

					{/* STEP 2: PEMBAGIAN KELOMPOK & NAMA SISWA */}
					{step === 2 && (
						<div className="space-y-5 animate-in fade-in duration-150">
							
							{/* Toolbar: Info Siswa & Aksi Cepat */}
							<div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
								<div>
									<h4 className="text-xs font-black uppercase text-cyan-300 flex items-center gap-1.5">
										<UserCheck className="w-4 h-4" />
										Daftar & Presensi Siswa: Kelas {formData.className || 'Kustom'}
									</h4>
									<div className="flex flex-wrap items-center gap-2 mt-1">
										<span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1">
											<CheckCircle className="w-3 h-3" /> {presentCount} Hadir (Diceklis)
										</span>
										{absentCount > 0 && (
											<span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 font-bold flex items-center gap-1">
												<UserX className="w-3 h-3" /> {absentCount} Tidak Hadir / Absen
											</span>
										)}
										<span className="text-[11px] text-slate-400">
											(Total {availableSiswa.length} Siswa)
										</span>
									</div>
								</div>

								<div className="flex items-center gap-2 shrink-0 flex-wrap">
									<button
										type="button"
										onClick={() => setShowManualStudentBoxInStep2(!showManualStudentBoxInStep2)}
										className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
									>
										<FileText className="w-3.5 h-3.5" />
										<span>{showManualStudentBoxInStep2 ? 'Tutup Input' : '📋 Tempel Siswa Sekaligus'}</span>
									</button>

									{availableSiswa.length > 0 && (
										<button
											type="button"
											onClick={handleAutoDistributeStudents}
											className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer shrink-0"
											title="Acak dan bagi hanya siswa yang diceklis (Hadir) ke dalam kelompok"
										>
											<Shuffle className="w-4 h-4" />
											Bagi Siswa Hadir ({presentCount})
										</button>
									)}
								</div>
							</div>

							{/* Collapsible Bulk Student Input Box in Step 2 */}
							{showManualStudentBoxInStep2 && (
								<div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 space-y-2 animate-in fade-in">
									<div className="flex items-center justify-between">
										<label className="text-xs font-bold uppercase text-cyan-300 flex items-center gap-1.5">
											<Users className="w-4 h-4" /> Tempel / Perbarui Seluruh Daftar Siswa:
										</label>
										<span className="text-[10px] text-slate-400">Pisahkan dengan koma atau baris baru</span>
									</div>
									<textarea
										rows={3}
										placeholder="Contoh: Andi, Budi, Citra, Dodi, Eko, Fajar, Gita..."
										value={manualStudentsText || availableSiswa.join('\n')}
										onChange={(e) => handleManualStudentsChange(e.target.value)}
										className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 custom-scrollbar"
									/>
								</div>
							)}

							{/* INTERACTIVE ATTENDANCE CHECKLIST (PRESENSI SISWA HADIR / TIDAK HADIR) */}
							{availableSiswa.length > 0 && (
								<div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-700 space-y-3 animate-in fade-in">
									<div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
										<div>
											<h5 className="text-xs font-black uppercase text-white flex items-center gap-2">
												<CheckSquare className="w-4 h-4 text-emerald-400" />
												Ceklis Kehadiran Siswa (Klik Nama Siswa untuk Ubah Status)
											</h5>
											<p className="text-[11px] text-slate-400">
												Siswa yang <strong className="text-rose-400">tidak diceklis (Absen)</strong> tidak akan dimasukkan ke kelompok saat diacak.
											</p>
										</div>

										<div className="flex items-center gap-2">
											<button
												type="button"
												onClick={() => handleSetAllAttendance(true)}
												className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 text-[10px] font-bold transition flex items-center gap-1"
											>
												<CheckCircle className="w-3 h-3" /> Ceklis Semua Hadir
											</button>
											<button
												type="button"
												onClick={() => handleSetAllAttendance(false)}
												className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10px] font-bold transition flex items-center gap-1"
											>
												<Square className="w-3 h-3" /> Batalkan Semua
											</button>
										</div>
									</div>

									{/* List of Student Badges with Checkbox toggle */}
									<div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-1">
										{availableSiswa.map((studentName) => {
											const isPresent = presentStudents.has(studentName);
											return (
												<button
													key={studentName}
													type="button"
													onClick={() => toggleStudentAttendance(studentName)}
													className={`px-2.5 py-1 rounded-xl text-xs font-medium border transition cursor-pointer flex items-center gap-1.5 ${
														isPresent
															? 'bg-emerald-950/80 border-emerald-500/70 text-emerald-100 hover:bg-emerald-900 shadow-sm'
															: 'bg-rose-950/40 border-rose-800/50 text-rose-400/70 hover:bg-rose-900/60 line-through opacity-75'
													}`}
													title={isPresent ? 'Klik untuk tandai tidak hadir (absen)' : 'Klik untuk tandai hadir'}
												>
													{isPresent ? (
														<CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
													) : (
														<UserX className="w-3.5 h-3.5 text-rose-400 shrink-0" />
													)}
													<span>{studentName}</span>
												</button>
											);
										})}
									</div>
								</div>
							)}

							{/* Grid Tim dan Anggotanya */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{teams.map((team, idx) => (
									<div
										key={team.id}
										className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/80 space-y-3 relative group"
									>
										{/* Header Tim: Warna + Nama */}
										<div className="flex items-center gap-2.5">
											<input
												type="color"
												value={team.color}
												onChange={(e) => handleTeamFieldChange(idx, 'color', e.target.value)}
												className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 shrink-0"
												title="Ubah warna kelompok"
											/>
											<div className="flex-1">
												<label className="text-[10px] uppercase font-bold text-slate-400 block">
													Nama Kelompok #{idx + 1}
												</label>
												<input
													type="text"
													required
													value={team.name}
													onChange={(e) => handleTeamFieldChange(idx, 'name', e.target.value)}
													className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-black text-white uppercase focus:outline-none focus:border-cyan-400"
												/>
											</div>

											<span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
												{team.students?.length || 0} Siswa
											</span>
										</div>

										{/* Input Anggota Siswa */}
										<div>
											<label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
												Daftar Nama Siswa Tim #{idx + 1} (Pisahkan koma / baris baru):
											</label>
											<textarea
												rows={3}
												placeholder="Contoh: Andi, Budi, Citra, Dodi..."
												value={studentInputs[idx] || team.students?.join(', ') || ''}
												onChange={(e) => handleStudentInputChange(idx, e.target.value)}
												className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 custom-scrollbar"
											/>
										</div>

										{/* Badge Preview Siswa */}
										{team.students && team.students.length > 0 && (
											<div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar pt-1">
												{team.students.map((sName, sIdx) => (
													<span
														key={sIdx}
														className="text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700/60"
													>
														{sName}
													</span>
												))}
											</div>
										)}

									</div>
								))}
							</div>

						</div>
					)}

					{/* Modal Footer / Navigation Buttons */}
					<div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
						
						{step === 2 ? (
							<button
								type="button"
								onClick={() => setStep(1)}
								className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
							>
								← Kembali ke Info Kelas & Siswa
							</button>
						) : (
							<div />
						)}

						<div className="flex items-center gap-3">
							{step === 1 ? (
								<button
									type="button"
									onClick={() => setStep(2)}
									className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
								>
									Lanjut: Presensi & Atur Kelompok <ArrowRight className="w-4 h-4" />
								</button>
							) : (
								<button
									type="submit"
									className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-pointer"
								>
									<CheckCircle className="w-4 h-4" />
									Mulai & Buka Arena Permainan
								</button>
							)}
						</div>

					</div>

				</form>

			</div>
		</div>
	);
}
