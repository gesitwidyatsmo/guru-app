"use client";
import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { 
	FlaskConical, 
	Play, 
	Pause, 
	Square, 
	SlidersHorizontal, 
	Trophy, 
	Medal, 
	Award, 
	Volume2, 
	VolumeX, 
	Maximize, 
	Minimize, 
	ChevronLeft, 
	RotateCcw, 
	Plus, 
	Users, 
	UserCheck, 
	Clock, 
	Calendar, 
	Trash2, 
	Search, 
	Sparkles, 
	Layers, 
	CheckCircle2, 
	BookOpen 
} from 'lucide-react';
import Link from 'next/link';
import { soundFX } from './utils/audio';
import QuestionModal from './components/QuestionModal';
import SettingsModal from './components/SettingsModal';
import PodiumModal from './components/PodiumModal';
import ScoreboardBar from './components/ScoreboardBar';
import CreateGameModal from './components/CreateGameModal';
import TeamRosterModal from './components/TeamRosterModal';
import QuestionBankManagerModal from './components/QuestionBankManagerModal';


const STORAGE_GAMES_KEY = 'chemistry_of_champion_games_v2';
const STORAGE_PACKAGES_KEY = 'chemistry_of_champion_packages_v2';
const emptySubscribe = () => () => {};

export default function ChemistryOfChampionHub() {
	// Native React hook for client-mount detection (Prevents SSR hydration mismatch & cascading renders)
	const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

// State: Games List & Question Packages (Hanya data real pengguna / database)
	const [gamesList, setGamesList] = useState([]);
	const [packages, setPackages] = useState([]);
	const [activeGameId, setActiveGameId] = useState(null); // null = Lobby, string = Arena

	// Lobby Search & Filter
	const [lobbyFilter, setLobbyFilter] = useState('all'); // 'all' | 'running' | 'finished'
	const [searchQuery, setSearchQuery] = useState('');

	// Active Game Data
	const activeGame = gamesList.find((g) => g.id === activeGameId) || null;

	// Active Package for current game
	const activeGamePackage = packages.find((p) => p.id === activeGame?.packageId) || null;
	const activeGameQuestions = activeGamePackage?.questions || [];

	// Arena-specific state
	const [arenaSeconds, setArenaSeconds] = useState(0);
	const [gameStatus, setGameStatus] = useState('idle');
	const arenaTimerRef = useRef(null);

	// Audio & Fullscreen
	const [isMuted, setIsMuted] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

	// Modals
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showBankManagerModal, setShowBankManagerModal] = useState(false);
	const [showRosterModal, setShowRosterModal] = useState(null);
	const [activeQuestion, setActiveQuestion] = useState(null);
	const [showSettings, setShowSettings] = useState(false);
	const [showPodium, setShowPodium] = useState(false);

	// Mount & Data Loading from Storage + Database
	useEffect(() => {
		async function initData() {
			let localGames = [];
			let localPkgs = [];

			// 1. Initial sync from localStorage cache (ambil data real yang dibuat pengguna)
			try {
				const savedGames = localStorage.getItem(STORAGE_GAMES_KEY);
				if (savedGames) {
					const parsed = JSON.parse(savedGames);
					if (Array.isArray(parsed) && parsed.length > 0) {
						localGames = parsed;
						setGamesList(localGames);
					}
				}

				const savedPkgs = localStorage.getItem(STORAGE_PACKAGES_KEY);
				if (savedPkgs) {
					const parsed = JSON.parse(savedPkgs);
					if (Array.isArray(parsed) && parsed.length > 0) {
						// Bersihkan preset dummy lama (kimia_xii, biologi_xii, dll.)
						// yang sudah tidak relevan dan tidak ada di Supabase
						const PRESET_IDS = ['kimia_xii', 'biologi_xii', 'fisika_xii', 'matematika_xii', 'pengetahuan_umum'];
						const cleanedPkgs = parsed.filter((p) => !PRESET_IDS.includes(p.id));
						localPkgs = cleanedPkgs;
						if (cleanedPkgs.length > 0) {
							setPackages(cleanedPkgs);
						}
						// Jika ada preset lama, perbarui localStorage agar bersih
						if (cleanedPkgs.length !== parsed.length) {
							localStorage.setItem(STORAGE_PACKAGES_KEY, JSON.stringify(cleanedPkgs));
						}
					}
				}
			} catch (e) {
				console.error('Error reading localStorage:', e);
			}

			// 2. Fetch fresh data from Database
			try {
				const [pkgRes, sessionRes] = await Promise.all([
					fetch('/api/game/packages'),
					fetch('/api/game/sessions')
				]);

				if (pkgRes.ok) {
					const pkgData = await pkgRes.json();
					if (Array.isArray(pkgData) && pkgData.length > 0) {
						setPackages(pkgData);
					} else if (localPkgs.length > 0) {
						// Jika di Supabase masih kosong tapi ada data modul real yang sudah Anda buat di browser:
						// Langsung unggah data real Anda ke Supabase!
						for (const p of localPkgs) {
							fetch('/api/game/packages', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(p)
							}).catch(console.error);
						}
					}
				}

				if (sessionRes.ok) {
					const sessionData = await sessionRes.json();
					if (Array.isArray(sessionData) && sessionData.length > 0) {
						setGamesList(sessionData);
					} else if (localGames.length > 0) {
						// Auto-sync data sesi lokal milik Anda ke Supabase
						for (const g of localGames) {
							fetch('/api/game/sessions', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify(g)
							}).catch(console.error);
						}
					}
				}
			} catch (err) {
				console.warn('Using local storage fallback for games and packages:', err);
			}
		}

		initData();
	}, []);

	// Save games list to localStorage as offline cache
	useEffect(() => {
		if (!isMounted) return;
		try {
			localStorage.setItem(STORAGE_GAMES_KEY, JSON.stringify(gamesList));
		} catch (e) {
			console.error('Error saving games list:', e);
		}
	}, [gamesList, isMounted]);

	// Save packages list to localStorage as offline cache
	useEffect(() => {
		if (!isMounted) return;
		try {
			localStorage.setItem(STORAGE_PACKAGES_KEY, JSON.stringify(packages));
		} catch (e) {
			console.error('Error saving packages:', e);
		}
	}, [packages, isMounted]);

	// Arena Timer effect
	useEffect(() => {
		if (activeGameId && gameStatus === 'running') {
			arenaTimerRef.current = setInterval(() => {
				setArenaSeconds((prev) => {
					const nextSec = prev + 1;
					setGamesList((list) =>
						list.map((g) =>
							g.id === activeGameId ? { ...g, arenaSeconds: nextSec, lastPlayed: new Date().toISOString() } : g
						)
					);
					return nextSec;
				});
			}, 1000);
		} else {
			clearInterval(arenaTimerRef.current);
		}
		return () => clearInterval(arenaTimerRef.current);
	}, [activeGameId, gameStatus]);

	// Explicit handler to open and load an active game
	const handleOpenGame = (gameId) => {
		soundFX.playClick();
		const targetGame = gamesList.find((g) => g.id === gameId);
		if (targetGame) {
			setArenaSeconds(targetGame.arenaSeconds || 0);
			setGameStatus(targetGame.gameStatus || 'idle');
		}
		setActiveGameId(gameId);
	};

	// Create New Game Handler
	const handleCreateGame = async (newGameSession) => {
		setGamesList((prev) => [newGameSession, ...prev]);
		setShowCreateModal(false);
		setArenaSeconds(0);
		setGameStatus('idle');
		setActiveGameId(newGameSession.id);

		// Sync with Database
		try {
			await fetch('/api/game/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newGameSession)
			});
		} catch (err) {
			console.error('Error saving game to DB:', err);
		}
	};

	// Delete Game Handler
	const handleDeleteGame = async (gameId, e) => {
		e.stopPropagation();
		if (confirm('Yakin ingin menghapus sesi permainan ini beserta riwayat skornya?')) {
			soundFX.playWrong();
			setGamesList((prev) => prev.filter((g) => g.id !== gameId));
			if (activeGameId === gameId) setActiveGameId(null);

			// Delete from Database
			try {
				await fetch(`/api/game/sessions?id=${gameId}`, { method: 'DELETE' });
			} catch (err) {
				console.error('Error deleting game from DB:', err);
			}
		}
	};

	// Question Package Management Handlers
	const handleCreatePackage = async (newPkg) => {
		setPackages((prev) => [...prev, newPkg]);

		// Save to Database
		try {
			await fetch('/api/game/packages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newPkg)
			});
		} catch (err) {
			console.error('Error creating package in DB:', err);
		}
	};

	const handleUpdatePackage = async (pkgId, updates) => {
		setPackages((prev) =>
			prev.map((p) => (p.id === pkgId ? { ...p, ...updates } : p))
		);

		// Sync ke Database
		try {
			const currentPkgData = packages.find((p) => p.id === pkgId) || {};
			const mergedPkg = { ...currentPkgData, ...updates };

			// 1. Pastikan paket ada di game_packages (upsert) — wajib sebelum upsert soal
			const pkgRes = await fetch('/api/game/packages', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: pkgId,
					name: mergedPkg.name || pkgId,
					subject: mergedPkg.subject || 'Umum',
					grade: mergedPkg.grade || 'Semua Tingkat',
					materi: mergedPkg.materi || '',
					icon: mergedPkg.icon || '📚',
					gameTitle: mergedPkg.gameTitle || '',
					tagline: mergedPkg.tagline || '',
					subTitle: mergedPkg.subTitle || '',
				})
			});

			if (!pkgRes.ok) {
				const pkgErr = await pkgRes.text().catch(() => 'Unknown error');
				console.error('Gagal upsert paket ke Supabase:', pkgErr);
				return; // Hentikan jika paket gagal disimpan — FK constraint akan violation
			}

			// 2. Sync soal jika ada perubahan questions
			if (updates.questions !== undefined) {
				if (updates.questions.length === 0) {
					// Jika semua soal dihapus, tidak ada yang perlu di-POST
					// Soal lama di DB akan tetap ada (tidak dihapus cascade dari client)
					// Ini acceptable karena sync unidirectional dari UI ke DB
				} else {
					const questionsToSync = updates.questions.map((q, idx) => ({
						...q,
						package_id: pkgId,
						question_number: typeof q.id === 'number' ? q.id : (idx + 1)
					}));

					const res = await fetch('/api/game/questions', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(questionsToSync)
					});

					if (!res.ok) {
						const errText = await res.text().catch(() => 'Unknown error');
						console.error('Gagal sync soal ke Supabase:', errText);
					}
				}
			}

			// 3. Update metadata paket jika ada perubahan selain questions
			const metaUpdates = { ...updates };
			delete metaUpdates.questions;
			if (Object.keys(metaUpdates).length > 0) {
				await fetch('/api/game/packages', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id: pkgId, ...metaUpdates })
				});
			}
		} catch (err) {
			console.error('Error updating package in DB:', err);
		}
	};


	const handleDeletePackage = async (pkgId) => {
		if (confirm('Hapus paket bank soal ini?')) {
			soundFX.playWrong();
			setPackages((prev) => prev.filter((p) => p.id !== pkgId));

			// Delete from Database
			try {
				await fetch(`/api/game/packages?id=${pkgId}`, { method: 'DELETE' });
			} catch (err) {
				console.error('Error deleting package from DB:', err);
			}
		}
	};

	// Manual Trigger: Sync all packages to Supabase Cloud
	const handleSyncPackagesToDb = async () => {
		soundFX.playClick();
		let count = 0;
		try {
			const targetList = packages;
			if (!targetList || targetList.length === 0) {
				alert('Belum ada paket modul soal yang dibuat untuk disinkronkan.');
				return;
			}
			for (const p of targetList) {
				await fetch('/api/game/packages', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(p)
				});
				count++;
			}
			soundFX.playCorrect();
			alert(`✅ Sukses! ${count} paket modul bank soal asli milik Anda berhasil disimpan dan disinkronkan ke Supabase.`);
		} catch (err) {
			console.error('Error syncing packages to Supabase:', err);
			soundFX.playWrong();
			alert('⚠️ Gagal sinkronisasi ke Supabase: ' + err.message);
		}
	};

	// Sound mute toggle
	const toggleMute = () => {
		const nextMute = !isMuted;
		setIsMuted(nextMute);
		soundFX.setMuted(nextMute);
		if (!nextMute) soundFX.playClick();
	};

	// Fullscreen toggle
	const toggleFullscreen = () => {
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen().catch(() => {});
			setIsFullscreen(true);
		} else {
			if (document.exitFullscreen) {
				document.exitFullscreen().catch(() => {});
				setIsFullscreen(false);
			}
		}
	};

	// Sync helper to update active game in Supabase
	const syncActiveGameToDb = (gameData) => {
		if (!gameData || !gameData.id) return;
		try {
			fetch('/api/game/sessions', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: gameData.id,
					teams: gameData.teams,
					tileStates: gameData.tileStates,
					arenaSeconds: gameData.arenaSeconds,
					gameStatus: gameData.gameStatus,
					config: gameData.config
				})
			}).catch((err) => console.error('Error syncing game session to DB:', err));
		} catch (e) {
			console.error(e);
		}
	};

	// Game Controls in Arena
	const handleStartGame = () => {
		soundFX.playClick();
		setGameStatus('running');
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const updated = { ...g, gameStatus: 'running' };
				syncActiveGameToDb(updated);
				return updated;
			})
		);
	};

	const handlePauseGame = () => {
		soundFX.playClick();
		setGameStatus('paused');
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const updated = { ...g, gameStatus: 'paused' };
				syncActiveGameToDb(updated);
				return updated;
			})
		);
	};

	const handleGameOver = () => {
		soundFX.playClick();
		setGameStatus('finished');
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const updated = { ...g, gameStatus: 'finished' };
				syncActiveGameToDb(updated);
				return updated;
			})
		);
		setShowPodium(true);
	};

	// Tile Click in Arena (Fetches question from active package)
	const handleTileClick = (qId) => {
		soundFX.playClick();
		const q = activeGameQuestions.find((item) => item.id === qId) || {
			id: qId,
			topic: activeGamePackage?.name || 'Materi Umum',
			question: `Pertanyaan kuis untuk nomor ${qId}`,
			options: ['Pilihan A', 'Pilihan B', 'Pilihan C', 'Pilihan D'],
			answer: 'Pilihan A',
			points: 10
		};
		setActiveQuestion(q);
	};

	// Claim Score in Arena
	const handleClaimScore = (qId, teamId, points) => {
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const updatedTeams = g.teams.map((t) =>
					t.id === teamId ? { ...t, score: (t.score || 0) + points } : t
				);
				const updatedTiles = {
					...g.tileStates,
					[qId]: { status: 'conquered', teamId, points }
				};
				const updatedGame = {
					...g,
					teams: updatedTeams,
					tileStates: updatedTiles,
					lastPlayed: new Date().toISOString()
				};
				syncActiveGameToDb(updatedGame);
				return updatedGame;
			})
		);
		setActiveQuestion(null);
	};

	// Mark Tile Skipped in Arena
	const handleMarkSkipped = (qId) => {
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const updatedTiles = {
					...g.tileStates,
					[qId]: { status: 'skipped', teamId: null, points: 0 }
				};
				const updatedGame = { ...g, tileStates: updatedTiles };
				syncActiveGameToDb(updatedGame);
				return updatedGame;
			})
		);
		setActiveQuestion(null);
	};

	// Direct Manual Score Update in Arena
	const handleUpdateScore = (teamId, delta) => {
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const updatedTeams = g.teams.map((t) =>
					t.id === teamId ? { ...t, score: Math.max(0, (t.score || 0) + delta) } : t
				);
				const updatedGame = { ...g, teams: updatedTeams };
				syncActiveGameToDb(updatedGame);
				return updatedGame;
			})
		);
	};

	// Reset Active Game
	const handleResetActiveGame = () => {
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const resetTeams = g.teams.map((t) => ({ ...t, score: 0 }));
				const updatedGame = {
					...g,
					teams: resetTeams,
					tileStates: {},
					arenaSeconds: 0,
					gameStatus: 'idle'
				};
				syncActiveGameToDb(updatedGame);
				return updatedGame;
			})
		);
		setArenaSeconds(0);
		setGameStatus('idle');
		setShowPodium(false);
	};

	// Save Settings Config
	const handleSaveConfig = (newConfig, newTeams) => {
		setGamesList((list) =>
			list.map((g) => {
				if (g.id !== activeGameId) return g;
				const updatedGame = { ...g, config: newConfig, teams: newTeams };
				syncActiveGameToDb(updatedGame);
				return updatedGame;
			})
		);
	};

	// Format Seconds to MM:SS
	const formatTime = (totalSec) => {
		const mins = Math.floor((totalSec || 0) / 60);
		const secs = (totalSec || 0) % 60;
		return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
	};

	// Filtered Games for Lobby
	const filteredGames = gamesList.filter((g) => {
		const matchesSearch =
			g.config?.gameTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			g.config?.className?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			g.config?.teacherName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
			g.packageName?.toLowerCase().includes(searchQuery.toLowerCase());

		if (!matchesSearch) return false;
		if (lobbyFilter === 'running') return g.gameStatus === 'running' || g.gameStatus === 'paused';
		if (lobbyFilter === 'finished') return g.gameStatus === 'finished';
		return true;
	});

	// =========================================================================
	// VIEW 1: LOBBY & RIWAYAT PERMAINAN (when activeGameId === null)
	// =========================================================================
	if (!activeGameId || !activeGame) {
		return (
			<div className="min-h-screen bg-[#070F21] text-slate-100 font-sans p-4 sm:p-8 flex flex-col items-center select-none">
				<div className="w-full max-w-6xl space-y-6 sm:space-y-8">
					
					{/* Lobby Header */}
					<div className="bg-[#0B1528]/95 border border-cyan-500/25 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
						
						<div className="flex items-start gap-4">
							<Link
								href="/game"
								className="p-3.5 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-2xl transition shadow-md shrink-0 mt-1"
								title="Kembali ke Menu Game"
							>
								<ChevronLeft className="w-6 h-6" />
							</Link>

							<div>
								<div className="flex items-center gap-2 mb-1">
									<div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
										<FlaskConical className="w-5 h-5" />
									</div>
									<span className="text-xs uppercase font-mono font-bold tracking-widest text-cyan-400">
										Arena Cerdas Cermat Multi-Mata Pelajaran
									</span>
								</div>
								<h1 className="text-2xl sm:text-4xl font-black uppercase tracking-wider text-white">
									CHAMPION ARENA
								</h1>
								<p className="text-xs sm:text-sm text-slate-400 mt-1">
									Cerdas cermat interaktif untuk Kimia, Biologi, Fisika, Matematika, dan berbagai mata pelajaran.
								</p>
							</div>
						</div>

						{/* Primary Action Buttons (Buat Game & Kelola Bank Soal) */}
						<div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
							<button
								onClick={() => {
									soundFX.playClick();
									setShowBankManagerModal(true);
								}}
								className="flex-1 md:flex-none px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-md hover:scale-105 active:scale-95 cursor-pointer"
							>
								<BookOpen className="w-4 h-4 text-cyan-400" />
								<span suppressHydrationWarning>
									📚 Kelola Bank Soal ({isMounted ? packages.length : 0} Mapel)
								</span>
							</button>

							<button
								onClick={() => {
									soundFX.playClick();
									setShowCreateModal(true);
								}}
								className="flex-1 md:flex-none px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-black font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 cursor-pointer"
							>
								<Plus className="w-5 h-5 stroke-[3]" />
								<span>+ Buat Game Baru</span>
							</button>
						</div>

					</div>

					{/* Lobby Filter Bar & Search */}
					<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
						
						{/* Tabs Filter */}
						<div className="flex items-center gap-2 bg-[#0B1528] p-1.5 rounded-2xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
							{[
								{ id: 'all', label: `Semua Sesi (${isMounted ? gamesList.length : 0})` },
								{ id: 'running', label: 'Sedang Aktif' },
								{ id: 'finished', label: 'Arsip / Selesai' },
							].map((tab) => (
								<button
									key={tab.id}
									onClick={() => setLobbyFilter(tab.id)}
									className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
										lobbyFilter === tab.id
											? 'bg-cyan-500 text-black shadow-sm font-black'
											: 'text-slate-400 hover:text-slate-200'
									}`}
								>
									<span suppressHydrationWarning>{tab.label}</span>
								</button>
							))}
						</div>

						{/* Search Bar */}
						<div className="relative w-full sm:w-72">
							<Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
							<input
								type="text"
								placeholder="Cari kelas, judul, mapel, atau guru..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-full bg-[#0B1528] border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
							/>
						</div>

					</div>

					{/* Games List Grid */}
					{filteredGames.length > 0 ? (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{filteredGames.map((game) => {
								const totalQ = game.totalQuestions || 100;
								const answered = Object.keys(game.tileStates || {}).length;
								const sortedT = [...(game.teams || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
								const leader = sortedT[0];
								const totalMembers = game.teams?.reduce((acc, t) => acc + (t.students?.length || 0), 0) || game.totalStudents || 0;

								return (
									<div
										key={game.id}
										onClick={() => handleOpenGame(game.id)}
										className="group relative bg-[#0B1528]/90 border border-slate-800 hover:border-cyan-500/60 rounded-3xl p-6 backdrop-blur-md shadow-lg hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all hover:-translate-y-1.5 flex flex-col justify-between cursor-pointer"
									>
										<div>
											{/* Card Header: Class & Status Badge */}
											<div className="flex items-center justify-between mb-3">
												<div className="flex items-center gap-1.5 flex-wrap">
													<span className="text-xs uppercase font-bold tracking-wider text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-xl border border-cyan-800">
														{game.config?.className || 'XII IPA'}
													</span>
													{game.packageName && (
														<span className="text-[10px] uppercase font-black text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-800">
															{game.packageName}
														</span>
													)}
												</div>

												<span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
													game.gameStatus === 'running'
														? 'bg-emerald-950 border-emerald-500 text-emerald-400 animate-pulse'
														: game.gameStatus === 'finished'
														? 'bg-amber-950 border-amber-500 text-amber-400'
														: 'bg-slate-800 border-slate-700 text-slate-300'
												}`}>
													{game.gameStatus === 'running' ? 'BERJALAN' : game.gameStatus === 'finished' ? 'SELESAI' : 'SIAP MAIN'}
												</span>
											</div>

											{/* Title & Teacher */}
											<h2 className="text-lg font-black uppercase text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
												{game.config?.gameTitle || 'CHEMISTRY OF CHAMPION'}
											</h2>
											<p className="text-xs text-slate-400 mt-0.5">
												Guru: <strong className="text-slate-200">{game.config?.teacherName}</strong>
												{game.materi && <span className="text-slate-400 block text-[11px] truncate mt-0.5">Bab: {game.materi}</span>}
											</p>

											{/* Info Stats (Teams, Students, Questions) */}
											<div className="grid grid-cols-3 gap-2 my-4 pt-3 border-t border-slate-800/80 text-center">
												<div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
													<span className="text-[9px] uppercase font-bold text-slate-500 block">Kelompok</span>
													<span className="text-xs font-black text-cyan-300">{game.teams?.length || 6} Tim</span>
												</div>
												<div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
													<span className="text-[9px] uppercase font-bold text-slate-500 block">Siswa</span>
													<span className="text-xs font-black text-emerald-300">{totalMembers} Orang</span>
												</div>
												<div className="bg-slate-900/60 p-2 rounded-xl border border-slate-800">
													<span className="text-[9px] uppercase font-bold text-slate-500 block">Soal</span>
													<span className="text-xs font-black text-amber-300">{totalQ} Soal</span>
												</div>
											</div>

											{/* Progress Soal Bar */}
											<div className="space-y-1 mb-4">
												<div className="flex items-center justify-between text-[11px]">
													<span className="text-slate-400 font-medium">Progres Papan:</span>
													<span className="font-mono font-bold text-cyan-300">{answered} / {totalQ} Soal</span>
												</div>
												<div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
													<div
														className="bg-cyan-400 h-full transition-all duration-500"
														style={{ width: `${(answered / totalQ) * 100}%` }}
													/>
												</div>
											</div>

											{/* Mini Leader / Winner Preview */}
											{leader && (
												<div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-between text-xs mb-4">
													<div className="flex items-center gap-2">
														<Trophy className="w-4 h-4 text-yellow-400" />
														<span className="text-slate-400">Peringkat 1:</span>
														<span
															className="font-black uppercase truncate max-w-[90px]"
															style={{ color: leader.color }}
														>
															{leader.name}
														</span>
													</div>
													<span className="font-mono font-bold text-white">{leader.score || 0} Poin</span>
												</div>
											)}
										</div>

										{/* Card Action Buttons */}
										<div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
											<button
												onClick={(e) => {
													e.stopPropagation();
													setShowRosterModal(game);
												}}
												className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 transition text-xs font-bold flex items-center gap-1.5"
												title="Lihat Nama Siswa di Kelompok"
											>
												<Users className="w-4 h-4" />
												<span className="hidden sm:inline">Anggota</span>
											</button>

											<div className="flex items-center gap-2">
												<button
													onClick={(e) => handleDeleteGame(game.id, e)}
													className="p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
													title="Hapus Sesi Game"
												>
													<Trash2 className="w-4 h-4" />
												</button>

												<button
													onClick={() => handleOpenGame(game.id)}
													className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md"
												>
													<Play className="w-3.5 h-3.5 fill-black" />
													<span>Buka Arena</span>
												</button>
											</div>
										</div>

									</div>
								);
							})}
						</div>
					) : (
						/* Empty State */
						<div className="bg-[#0B1528]/60 border-2 border-dashed border-slate-800 rounded-3xl p-12 text-center space-y-4">
							<div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center justify-center mx-auto">
								<Layers className="w-8 h-8" />
							</div>
							<h3 className="text-xl font-black uppercase text-white">
								Belum Ada Sesi Permainan yang Cocok
							</h3>
							<p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
								Buat sesi permainan baru dengan memilih mata pelajaran, kelas, bank soal, dan kelompok siswa.
							</p>
							<div className="flex items-center justify-center gap-3">
								<button
									onClick={() => setShowBankManagerModal(true)}
									className="px-5 py-2.5 rounded-xl bg-slate-800 text-cyan-300 font-bold text-xs uppercase tracking-wider transition border border-cyan-500/40"
								>
									📚 Kelola Soal
								</button>
								<button
									onClick={() => setShowCreateModal(true)}
									className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xs uppercase tracking-wider transition inline-flex items-center gap-2 shadow-lg"
								>
									<Plus className="w-4 h-4 stroke-[3]" /> Buat Game Sekarang
								</button>
							</div>
						</div>
					)}

				</div>

				{/* MODALS in Lobby */}
				{showCreateModal && (
					<CreateGameModal
						packages={packages}
						onOpenBankManager={() => {
							setShowCreateModal(false);
							setShowBankManagerModal(true);
						}}
						onClose={() => setShowCreateModal(false)}
						onCreateGame={handleCreateGame}
					/>
				)}

				{showBankManagerModal && (
					<QuestionBankManagerModal
						packages={packages}
						activePackageId="kimia"
						onSelectPackage={() => {}}
						onCreatePackage={handleCreatePackage}
						onUpdatePackage={handleUpdatePackage}
						onDeletePackage={handleDeletePackage}
						onSyncToDb={handleSyncPackagesToDb}
						onClose={() => setShowBankManagerModal(false)}
					/>
				)}

				{showRosterModal && (
					<TeamRosterModal
						game={showRosterModal}
						onClose={() => setShowRosterModal(null)}
					/>
				)}

			</div>
		);
	}

	// =========================================================================
	// VIEW 2: ARENA GAMEPLAY VIEW (when activeGameId !== null)
	// =========================================================================
	const answeredCount = Object.keys(activeGame.tileStates || {}).length;
	const totalQCount = activeGame.totalQuestions || 100;
	const sortedTeams = [...(activeGame.teams || [])].sort((a, b) => (b.score || 0) - (a.score || 0));

	return (
		<div className="min-h-screen bg-[#070F21] text-slate-100 font-sans p-3 sm:p-6 lg:p-8 flex flex-col items-center select-none">
			
			<div className="w-full max-w-[1400px] space-y-4 sm:space-y-6">
				
				{/* ===================== TOP HEADER & CONTROL SECTION ===================== */}
				<div className="bg-[#0B1528]/95 border border-cyan-500/25 rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
					
					{/* Header Top Row */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
						
						{/* Title & Brand */}
						<div className="flex items-start gap-3 sm:gap-4">
							<button
								onClick={() => {
									soundFX.playClick();
									setActiveGameId(null);
								}}
								className="p-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-2xl transition shadow-md shrink-0 mt-1 flex items-center gap-1.5"
								title="Kembali ke Daftar Game / Riwayat"
							>
								<ChevronLeft className="w-5 h-5" />
								<span className="text-xs font-bold hidden sm:inline">Lobby Game</span>
							</button>

							<div className="space-y-0.5">
								<div className="flex items-center gap-2">
									<div className="p-1.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
										<FlaskConical className="w-5 h-5" />
									</div>
									<span className="text-xs sm:text-sm font-bold tracking-wider text-cyan-300 font-mono">
										{activeGame.config?.subTitle || `${activeGame.packageName || 'Kimia'} Class Arena`}
									</span>
									{activeGame.packageName && (
										<span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800">
											{activeGame.packageName}
										</span>
									)}
								</div>

								<h1 className="text-2xl sm:text-4xl font-black uppercase tracking-wider text-white drop-shadow-[0_2px_10px_rgba(6,182,212,0.3)]">
									{activeGame.config?.gameTitle || 'CHEMISTRY OF CHAMPION'}
								</h1>

								<p className="text-xs sm:text-sm text-slate-400 italic font-medium">
									{activeGame.config?.tagline || 'Think Fast. Solve Smart. Become the Champion!'}
								</p>
							</div>
						</div>

						{/* Quick Utility Tools */}
						<div className="flex items-center gap-2 self-end md:self-center">
							<button
								onClick={() => setShowBankManagerModal(true)}
								className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 transition shadow-sm flex items-center gap-1.5 text-xs font-bold"
								title="Buka Bank Soal"
							>
								<BookOpen className="w-4 h-4 text-cyan-400" />
								<span className="hidden sm:inline">Bank Soal</span>
							</button>

							<button
								onClick={() => setShowRosterModal(activeGame)}
								className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-cyan-300 transition shadow-sm flex items-center gap-1.5 text-xs font-bold"
								title="Lihat Daftar Anggota Kelompok Siswa"
							>
								<Users className="w-4 h-4 text-cyan-400" />
								<span className="hidden sm:inline">Daftar Siswa</span>
							</button>

							<button
								onClick={toggleMute}
								className={`p-2.5 rounded-2xl border transition shadow-sm ${
									isMuted
										? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
										: 'bg-slate-800/80 border-slate-700 text-cyan-300 hover:bg-slate-700'
								}`}
								title={isMuted ? 'Nyalakan Suara' : 'Matikan Suara'}
							>
								{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
							</button>

							<button
								onClick={toggleFullscreen}
								className="p-2.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 transition shadow-sm"
								title="Layar Penuh"
							>
								{isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
							</button>
						</div>
					</div>

					{/* Control Bar: Timer, Mulai, Pause, Game Over, Settings */}
					<div className="flex flex-wrap items-center justify-between gap-3 pt-4">
						
						{/* Left: Timer Arena & Buttons */}
						<div className="flex flex-wrap items-center gap-2 sm:gap-3">
							
							{/* WAKTU ARENA BADGE */}
							<div className="bg-[#070F21] border border-cyan-500/40 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-inner">
								<div className="flex flex-col">
									<span className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
										WAKTU ARENA
									</span>
									<span className="text-xl sm:text-2xl font-black font-mono text-cyan-300 tracking-wider">
										{formatTime(arenaSeconds)}
									</span>
								</div>
							</div>

							{/* MULAI GAME BUTTON */}
							<button
								onClick={handleStartGame}
								disabled={gameStatus === 'running'}
								className={`px-4 sm:px-6 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
									gameStatus === 'running'
										? 'bg-emerald-800/50 text-emerald-300/50 cursor-not-allowed border border-emerald-700/40'
										: 'bg-emerald-500 hover:bg-emerald-400 text-black border-2 border-emerald-300 active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
								}`}
							>
								<Play className="w-4 h-4 fill-current" />
								<span>MULAI GAME</span>
							</button>

							{/* PAUSE BUTTON */}
							<button
								onClick={handlePauseGame}
								disabled={gameStatus !== 'running'}
								className={`px-4 sm:px-5 py-3 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
									gameStatus !== 'running'
										? 'bg-amber-900/30 text-amber-300/40 cursor-not-allowed border border-amber-800/30'
										: 'bg-amber-400 hover:bg-amber-300 text-black border-2 border-amber-200 active:scale-95 shadow-[0_0_15px_rgba(250,204,21,0.4)]'
								}`}
							>
								<Pause className="w-4 h-4 fill-current" />
								<span>PAUSE</span>
							</button>

							{/* GAME OVER BUTTON */}
							<button
								onClick={handleGameOver}
								className="px-4 sm:px-5 py-3 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center gap-2 border-2 border-rose-400 active:scale-95 shadow-[0_0_20px_rgba(244,63,94,0.4)] cursor-pointer"
							>
								<Square className="w-4 h-4 fill-current" />
								<span>GAME OVER</span>
							</button>

							{/* SETTINGS BUTTON */}
							<button
								onClick={() => setShowSettings(true)}
								className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 transition active:scale-95 shadow-md"
								title="Pengaturan Game"
							>
								<SlidersHorizontal className="w-5 h-5" />
							</button>
						</div>

						{/* Right: Info Badges */}
						<div className="flex flex-wrap items-center gap-2 text-xs font-bold">
							<div className="bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/80 text-slate-300">
								KELAS: <span className="text-white font-black">{activeGame.config?.className || 'XII IPA'}</span>
							</div>

							<div className="bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-700/80 text-slate-300">
								GURU: <span className="text-white font-black">{activeGame.config?.teacherName || 'Mrs Nunung'}</span>
							</div>

							{/* Status Badge */}
							<div className={`px-3 py-1.5 rounded-xl border font-black uppercase text-[11px] tracking-wider ${
								gameStatus === 'running'
									? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400 animate-pulse'
									: gameStatus === 'paused'
									? 'bg-amber-950/80 border-amber-500/60 text-amber-400'
									: gameStatus === 'finished'
									? 'bg-rose-950/80 border-rose-500/60 text-rose-400'
									: 'bg-yellow-950/70 border-yellow-600/60 text-yellow-400'
							}`}>
								{gameStatus === 'running' && 'BERJALAN'}
								{gameStatus === 'paused' && 'JEDA'}
								{gameStatus === 'finished' && 'SELESAI'}
								{gameStatus === 'idle' && 'MENUNGGU DIMULAI'}
							</div>
						</div>
					</div>

				</div>

				{/* ===================== SCOREBOARD SECTION ===================== */}
				<ScoreboardBar
					teams={activeGame.teams || []}
					onUpdateScore={handleUpdateScore}
					onViewRoster={() => setShowRosterModal(activeGame)}
				/>

				{/* ===================== MAIN GRID (ARENA SOAL) & LEADERBOARD ===================== */}
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
					
					{/* LEFT / CENTER: ARENA GRID */}
					<div className="lg:col-span-8 xl:col-span-9 bg-[#0B1528]/95 border border-cyan-500/25 rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-xl flex flex-col">
						
						{/* Grid Header & Progress */}
						<div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
							<div>
								<span className="text-[11px] uppercase font-bold tracking-widest text-cyan-400 block">
									PILIH TANTANGANMU
								</span>
								<h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white">
									ARENA {totalQCount} SOAL
								</h2>
							</div>

							<div className="bg-[#070F21] border border-cyan-500/40 px-4 py-1.5 rounded-2xl flex items-center gap-2 font-mono font-bold text-sm text-cyan-300 shadow-inner">
								<span>{answeredCount}</span>
								<span className="text-slate-500">/</span>
								<span>{totalQCount}</span>
							</div>
						</div>

						{/* Grid of Question Tiles */}
						<div className={`grid gap-2 sm:gap-2.5 flex-1 items-stretch ${
							totalQCount <= 25 ? 'grid-cols-5' : totalQCount <= 50 ? 'grid-cols-5 sm:grid-cols-10' : 'grid-cols-5 sm:grid-cols-10'
						}`}>
							{Array.from({ length: totalQCount }, (_, i) => i + 1).map((num) => {
								const state = (activeGame.tileStates || {})[num];
								const isConquered = state?.status === 'conquered';
								const isSkipped = state?.status === 'skipped';

								// Determine conquered team color
								const conqueredTeam = isConquered ? activeGame.teams?.find((t) => t.id === state.teamId) : null;

								let tileBg = 'bg-[#89CFF0] hover:bg-[#A0D8F8] text-[#0A192F] shadow-sm border-transparent';
								let customStyle = {};

								if (isConquered && conqueredTeam) {
									tileBg = 'text-black font-black border-2 border-white/60 shadow-md';
									customStyle = {
										backgroundColor: conqueredTeam.color,
										boxShadow: `0 0 12px ${conqueredTeam.color}80`
									};
								} else if (isSkipped) {
									tileBg = 'bg-slate-800/80 text-slate-500 border border-slate-700/60 line-through';
								}

								return (
									<button
										key={num}
										onClick={() => handleTileClick(num)}
										style={customStyle}
										className={`aspect-square rounded-2xl flex flex-col items-center justify-center font-black text-sm sm:text-base md:text-lg transition-all hover:scale-105 active:scale-95 cursor-pointer select-none group relative ${tileBg}`}
										title={`Soal #${num}${isConquered ? ` (Dikuasai ${conqueredTeam?.name})` : ''}`}
									>
										<span>{num}</span>
										{isConquered && conqueredTeam && (
											<span className="text-[8px] font-black uppercase tracking-tighter truncate max-w-full px-1">
												{conqueredTeam.name.slice(0, 3)}
											</span>
										)}
									</button>
								);
							})}
						</div>

					</div>

					{/* RIGHT: LEADERBOARD PANEL */}
					<div className="lg:col-span-4 xl:col-span-3 bg-[#0B1528]/95 border border-cyan-500/25 rounded-3xl p-4 sm:p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
						
						<div>
							{/* Leaderboard Header */}
							<div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-slate-800">
								<Trophy className="w-6 h-6 text-yellow-400" />
								<h2 className="text-xl font-black uppercase tracking-wider text-white">
									LEADERBOARD
								</h2>
							</div>

							{/* Ranked Teams List */}
							<div className="space-y-3">
								{sortedTeams.map((team, idx) => {
									const isFirst = idx === 0 && (team.score || 0) > 0;

									return (
										<div
											key={team.id}
											className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
												isFirst
													? 'bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-900 border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.2)] ring-1 ring-amber-400/50'
													: 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700'
											}`}
										>
											{/* Rank Badge + Color Dot + Name + Student Count */}
											<div className="flex items-center gap-3 min-w-0">
												<div className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
													{idx === 0 && <Trophy className="w-5 h-5 text-yellow-400" />}
													{idx === 1 && <Medal className="w-5 h-5 text-slate-300" />}
													{idx === 2 && <Award className="w-5 h-5 text-amber-600" />}
													{idx >= 3 && (
														<span className="text-slate-400 font-mono text-sm">
															{idx + 1}
														</span>
													)}
												</div>

												<span
													className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
													style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}` }}
												/>

												<div className="min-w-0">
													<span className="font-black text-sm uppercase text-slate-100 truncate block">
														{team.name}
													</span>
													{team.students?.length > 0 && (
														<span className="text-[10px] text-slate-400 truncate block">
															{team.students.length} Siswa
														</span>
													)}
												</div>
											</div>

											{/* Score */}
											<div className="shrink-0 font-mono font-black text-lg text-white">
												{team.score || 0}
											</div>
										</div>
									);
								})}
							</div>
						</div>

						{/* Quick Actions / Reset Buttons */}
						<div className="pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between gap-2">
							<button
								onClick={handleGameOver}
								className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black text-xs font-black uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
							>
								<Trophy className="w-4 h-4" />
								<span>Podium Juara</span>
							</button>

							<button
								onClick={() => {
									if (confirm("Reset ulang sesi ini? Semua skor dan kartu akan kembali ke 0.")) {
										handleResetActiveGame();
									}
								}}
								className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
								title="Reset Permainan Sesi Ini"
							>
								<RotateCcw className="w-4 h-4" />
							</button>
						</div>

					</div>

				</div>

			</div>

			{/* ===================== MODALS IN ARENA ===================== */}

			{/* 1. Question Modal */}
			{activeQuestion && (
				<QuestionModal
					question={activeQuestion}
					teams={activeGame.teams || []}
					onClose={() => setActiveQuestion(null)}
					onClaimScore={handleClaimScore}
					onMarkSkipped={handleMarkSkipped}
				/>
			)}

			{/* 2. Settings Modal */}
			{showSettings && (
				<SettingsModal
					config={activeGame.config || {}}
					teams={activeGame.teams || []}
					questions={activeGameQuestions}
					onSaveConfig={handleSaveConfig}
					onResetGame={handleResetActiveGame}
					onResetQuestions={() => {}}
					onClose={() => setShowSettings(false)}
				/>
			)}

			{/* 3. Podium / Victory Celebration Modal */}
			{showPodium && (
				<PodiumModal
					teams={activeGame.teams || []}
					answeredCount={answeredCount}
					totalCount={totalQCount}
					durationStr={formatTime(arenaSeconds)}
					onRestart={handleResetActiveGame}
					onClose={() => setShowPodium(false)}
				/>
			)}

			{/* 4. Team Roster Modal */}
			{showRosterModal && (
				<TeamRosterModal
					game={showRosterModal}
					onClose={() => setShowRosterModal(null)}
				/>
			)}

			{/* 5. Question Bank Manager Modal */}
			{showBankManagerModal && (
				<QuestionBankManagerModal
					packages={packages}
					activePackageId={activeGame.packageId || 'kimia'}
					onSelectPackage={() => {}}
					onCreatePackage={handleCreatePackage}
					onUpdatePackage={handleUpdatePackage}
					onDeletePackage={handleDeletePackage}
					onSyncToDb={handleSyncPackagesToDb}
					onClose={() => setShowBankManagerModal(false)}
				/>
			)}

		</div>
	);
}
