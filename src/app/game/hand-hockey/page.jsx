'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─── Stream singleton: survives React re-renders & soft navigation ───────────
let _activeStream = null;
function stopActiveStream() {
	if (_activeStream) {
		_activeStream.getTracks().forEach((t) => t.stop());
		_activeStream = null;
	}
}
if (typeof window !== 'undefined') {
	// Also stop when user tabs away, closes tab, or hard-refreshes
	window.addEventListener('pagehide', stopActiveStream);
	window.addEventListener('beforeunload', stopActiveStream);
}

export default function HandHockey() {
	const router = useRouter();

	// ── React UI state ─────────────────────────────────────────────────────────
	const [screen, setScreen] = useState('menu');
	// "menu" | "preflight" | "loading" | "playing" | "gameover" | "error"
	const [loadingStep, setLoadingStep] = useState(0); // 0-3
	const [loadingMsg, setLoadingMsg] = useState('');
	const [errorInfo, setErrorInfo] = useState({ title: '', body: '', hint: '' });
	const [scores, setScores] = useState({ p1: 0, p2: 0 });
	const [winner, setWinner] = useState(null);

	// ── Refs ───────────────────────────────────────────────────────────────────
	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const handLandmarkerRef = useRef(null);
	const rafRef = useRef(null);
	const isRunning = useRef(false);
	const gameModeRef = useRef('ai');
	const winnerTriggered = useRef(false);

	const GS = useRef({
		W: 1000,
		H: 600,
		GOAL: 250,
		puck: { x: 500, y: 300, vx: 4, vy: 2, r: 14, maxV: 22 },
		p1: { x: 100, y: 300, r: 32, color: '#ec4899', score: 0 },
		p2: { x: 900, y: 300, r: 32, color: '#22d3ee', score: 0 },
	});

	// ── Helpers ────────────────────────────────────────────────────────────────
	const resetPuck = (losingSide) => {
		const g = GS.current;
		const spd = 4;
		g.puck.x = g.W / 2;
		g.puck.y = g.H / 2;
		g.puck.vx = losingSide === 1 ? spd : losingSide === 2 ? -spd : Math.random() > 0.5 ? spd : -spd;
		g.puck.vy = (Math.random() - 0.5) * spd;
	};

	/** Stop game loop AND kamera. Safe to call multiple times. */
	const stopEverything = useCallback(() => {
		isRunning.current = false;
		if (rafRef.current) {
			cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
		}
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}
		stopActiveStream();
	}, []);

	/** Navigate back and ensure camera is dead first */
	const goBack = useCallback(() => {
		stopEverything();
		router.push('/game');
	}, [stopEverything, router]);

	// Cleanup on component unmount (soft navigation / React strict-mode etc.)
	useEffect(() => {
		return () => stopEverything();
	}, [stopEverything]);

	// ── Game Loop (only refs, zero React state inside) ─────────────────────────
	const gameLoop = useCallback(() => {
		if (!isRunning.current) return;

		const g = GS.current;
		const canvas = canvasRef.current;
		const video = videoRef.current;
		const hl = handLandmarkerRef.current;

		// 1. Hand tracking
		if (video && hl && video.readyState >= 2) {
			try {
				const res = hl.detectForVideo(video, performance.now());
				if (res?.landmarks) {
					res.landmarks.forEach((lm) => {
						const tip = lm[8];
						const mx = (1 - tip.x) * g.W; // mirrored X
						const my = tip.y * g.H;
						if (mx < g.W / 2) {
							g.p1.x += (mx - g.p1.x) * 0.4;
							g.p1.y += (my - g.p1.y) * 0.4;
						} else if (gameModeRef.current === 'p2') {
							g.p2.x += (mx - g.p2.x) * 0.4;
							g.p2.y += (my - g.p2.y) * 0.4;
						}
					});
				}
			} catch {
				/* ignore mid-init frames */
			}
		}

		// 2. AI
		if (gameModeRef.current === 'ai') {
			if (g.puck.x > g.W / 2) {
				g.p2.y += (g.puck.y - g.p2.y) * 0.08;
				g.p2.x += (Math.min(g.W - 120, g.puck.x + 50) - g.p2.x) * 0.08;
			} else {
				g.p2.y += (g.H / 2 - g.p2.y) * 0.04;
				g.p2.x += (g.W - 100 - g.p2.x) * 0.04;
			}
		}

		// 3. Confine paddles
		const confine = (p, lx, rx) => {
			p.x = Math.max(lx + p.r, Math.min(rx - p.r, p.x));
			p.y = Math.max(p.r, Math.min(g.H - p.r, p.y));
		};
		confine(g.p1, 0, g.W / 2);
		confine(g.p2, g.W / 2, g.W);

		// 4. Physics
		g.puck.x += g.puck.vx;
		g.puck.y += g.puck.vy;
		g.puck.vx *= 0.995;
		g.puck.vy *= 0.995;
		if (g.puck.y - g.puck.r < 0) {
			g.puck.y = g.puck.r;
			g.puck.vy *= -1;
		}
		if (g.puck.y + g.puck.r > g.H) {
			g.puck.y = g.H - g.puck.r;
			g.puck.vy *= -1;
		}
		const inGoalY = g.puck.y > (g.H - g.GOAL) / 2 && g.puck.y < (g.H + g.GOAL) / 2;
		if (!inGoalY) {
			if (g.puck.x - g.puck.r < 0) {
				g.puck.x = g.puck.r;
				g.puck.vx *= -1;
			}
			if (g.puck.x + g.puck.r > g.W) {
				g.puck.x = g.W - g.puck.r;
				g.puck.vx *= -1;
			}
		}
		const spd = Math.hypot(g.puck.vx, g.puck.vy);
		if (spd > g.puck.maxV) {
			g.puck.vx *= g.puck.maxV / spd;
			g.puck.vy *= g.puck.maxV / spd;
		}
		const paddleHit = (p) => {
			const dx = g.puck.x - p.x,
				dy = g.puck.y - p.y;
			const dist = Math.hypot(dx, dy),
				minD = g.puck.r + p.r;
			if (dist < minD && dist > 0) {
				const nx = dx / dist,
					ny = dy / dist;
				g.puck.x += nx * (minD - dist);
				g.puck.y += ny * (minD - dist);
				const dot = g.puck.vx * nx + g.puck.vy * ny;
				g.puck.vx = (g.puck.vx - 2 * dot * nx) * 1.1;
				g.puck.vy = (g.puck.vy - 2 * dot * ny) * 1.1;
			}
		};
		paddleHit(g.p1);
		paddleHit(g.p2);

		// 5. Goal check
		if (!winnerTriggered.current) {
			if (g.puck.x + g.puck.r < 0 && inGoalY) {
				g.p2.score++;
				setScores({ p1: g.p1.score, p2: g.p2.score });
				if (g.p2.score >= 5) {
					triggerWin(2);
					return;
				}
				resetPuck(1);
			} else if (g.puck.x - g.puck.r > g.W && inGoalY) {
				g.p1.score++;
				setScores({ p1: g.p1.score, p2: g.p2.score });
				if (g.p1.score >= 5) {
					triggerWin(1);
					return;
				}
				resetPuck(2);
			}
		}

		// 6. Render
		if (canvas) drawScene(canvas.getContext('2d'), g, video);

		rafRef.current = requestAnimationFrame(gameLoop);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const triggerWin = (player) => {
		winnerTriggered.current = true;
		isRunning.current = false;
		if (rafRef.current) cancelAnimationFrame(rafRef.current);
		// Keep camera alive so background stays visible in gameover screen
		setWinner(player);
		setScreen('gameover');
	};

	// ── Draw ───────────────────────────────────────────────────────────────────
	const drawScene = (ctx, g, video) => {
		ctx.clearRect(0, 0, g.W, g.H);
		if (video && video.readyState >= 2 && video.videoWidth > 0) {
			ctx.save();
			ctx.translate(g.W, 0);
			ctx.scale(-1, 1);
			const vr = video.videoWidth / video.videoHeight,
				cr = g.W / g.H;
			let dw,
				dh,
				dx = 0,
				dy = 0;
			if (vr > cr) {
				dh = g.H;
				dw = dh * vr;
				dx = -(dw - g.W) / 2;
			} else {
				dw = g.W;
				dh = dw / vr;
				dy = -(dh - g.H) / 2;
			}
			ctx.drawImage(video, dx, dy, dw, dh);
			ctx.restore();
			// ctx.fillStyle = 'rgba(5,11,30,0.82)';
			// ctx.fillRect(0, 0, g.W, g.H);
		} else {
			ctx.fillStyle = '#050b1e';
			ctx.fillRect(0, 0, g.W, g.H);
		}
		// Field
		ctx.save();
		ctx.strokeStyle = 'rgba(255,255,255,0.12)';
		ctx.lineWidth = 2;
		ctx.setLineDash([12, 8]);
		ctx.beginPath();
		ctx.moveTo(g.W / 2, 0);
		ctx.lineTo(g.W / 2, g.H);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.shadowBlur = 8;
		ctx.shadowColor = 'rgba(255,255,255,0.15)';
		ctx.beginPath();
		ctx.arc(g.W / 2, g.H / 2, 70, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
		// Goals
		const gy = (g.H - g.GOAL) / 2;
		ctx.save();
		ctx.lineWidth = 6;
		ctx.shadowBlur = 18;
		ctx.shadowColor = g.p1.color;
		ctx.strokeStyle = g.p1.color;
		ctx.beginPath();
		ctx.moveTo(2, gy);
		ctx.lineTo(2, gy + g.GOAL);
		ctx.stroke();
		ctx.shadowColor = g.p2.color;
		ctx.strokeStyle = g.p2.color;
		ctx.beginPath();
		ctx.moveTo(g.W - 2, gy);
		ctx.lineTo(g.W - 2, gy + g.GOAL);
		ctx.stroke();
		ctx.restore();
		// Puck
		ctx.save();
		ctx.shadowBlur = 25;
		ctx.shadowColor = '#facc15';
		ctx.fillStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc(g.puck.x, g.puck.y, g.puck.r, 0, Math.PI * 2);
		ctx.fill();
		ctx.shadowBlur = 0;
		ctx.fillStyle = '#facc15';
		ctx.beginPath();
		ctx.arc(g.puck.x, g.puck.y, g.puck.r * 0.45, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		// Paddles
		const drawPaddle = (p, label) => {
			ctx.save();
			ctx.shadowBlur = 30;
			ctx.shadowColor = p.color;
			ctx.fillStyle = 'rgba(0,0,0,0.7)';
			ctx.strokeStyle = p.color;
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.shadowBlur = 12;
			ctx.fillStyle = p.color;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r * 0.38, 0, Math.PI * 2);
			ctx.fill();
			ctx.shadowBlur = 0;
			ctx.fillStyle = '#fff';
			ctx.font = 'bold 11px monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(label, p.x, p.y + p.r + 14);
			ctx.restore();
		};
		drawPaddle(g.p1, 'P1');
		drawPaddle(g.p2, gameModeRef.current === 'ai' ? 'AI' : 'P2');
	};

	// ── Start Game (with graceful error handling) ──────────────────────────────
	const startGame = async (mode) => {
		stopEverything();
		gameModeRef.current = mode;
		winnerTriggered.current = false;
		GS.current.p1.score = 0;
		GS.current.p2.score = 0;
		GS.current.p1.x = 100;
		GS.current.p1.y = 300;
		GS.current.p2.x = 900;
		GS.current.p2.y = 300;
		setScores({ p1: 0, p2: 0 });
		setWinner(null);
		setScreen('loading');
		setLoadingStep(0);

		// ── Step 1: Camera ────────────────────────────────────────────────────────
		try {
			setLoadingMsg('Meminta akses kamera…');
			setLoadingStep(1);
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 }, facingMode: 'user' },
				audio: false,
			});
			_activeStream = stream;
			videoRef.current.srcObject = stream;
			await videoRef.current.play();
		} catch (err) {
			const denied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
			setErrorInfo({
				title: denied ? 'Kamera Diblokir' : 'Kamera Tidak Ditemukan',
				body: denied ? 'Izin kamera ditolak oleh browser atau sistem operasi.' : `Error: ${err.message}`,
				hint: denied
					? "Buka pengaturan browser (ikon kunci di address bar) → Izinkan 'Kamera' untuk situs ini, lalu muat ulang halaman."
					: 'Pastikan perangkat memiliki kamera yang berfungsi dan tidak digunakan aplikasi lain.',
			});
			setScreen('error');
			return;
		}

		// ── Step 2: Connectivity pre-check ───────────────────────────────────────
		setLoadingMsg('Memeriksa koneksi internet…');
		setLoadingStep(2);
		const online = navigator.onLine;
		if (!online) {
			setErrorInfo({
				title: 'Tidak Ada Koneksi Internet',
				body: 'Game ini membutuhkan internet untuk mengunduh model AI Hand Tracking (~10 MB) saat pertama kali dimainkan.',
				hint: 'Sambungkan ke Wi-Fi atau data seluler, lalu coba lagi.',
			});
			stopEverything();
			setScreen('error');
			return;
		}

		// ── Step 3: MediaPipe Model ───────────────────────────────────────────────
		try {
			setLoadingMsg('Memuat model AI Hand Tracking… (±10 MB, sekali unduh)');
			setLoadingStep(3);
			if (!handLandmarkerRef.current) {
				// DYNAMIC IMPORT: Load library berat ini hanya saat user klik main
				const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
				const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
				// Try GPU first, fall back to CPU for older/mobile devices
				let hl = null;
				for (const delegate of ['GPU', 'CPU']) {
					try {
						hl = await HandLandmarker.createFromOptions(vision, {
							baseOptions: {
								modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
								delegate,
							},
							runningMode: 'VIDEO',
							numHands: 2,
						});
						break; // success
					} catch {
						if (delegate === 'CPU') throw new Error('Tidak bisa memuat model (GPU & CPU gagal).');
					}
				}
				handLandmarkerRef.current = hl;
			}
		} catch (err) {
			setErrorInfo({
				title: 'Gagal Memuat Model AI',
				body: `Error: ${err.message}`,
				hint: 'Kemungkinan penyebab: koneksi lambat/terputus di tengah jalan, atau browser terlalu lama. Coba refresh dan ulangi. Pastikan Anda menggunakan Chrome/Edge versi terbaru.',
			});
			stopEverything();
			setScreen('error');
			return;
		}

		// ── Play! ─────────────────────────────────────────────────────────────────
		resetPuck(0);
		isRunning.current = true;
		setScreen('playing');
		setLoadingStep(4);
		rafRef.current = requestAnimationFrame(gameLoop);
	};

	// ── UI helpers ─────────────────────────────────────────────────────────────
	const BtnBack = ({ className = '' }) => (
		<button
			onClick={goBack}
			className={`flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm ${className}`}>
			<svg
				width='16'
				height='16'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='2'
				strokeLinecap='round'
				strokeLinejoin='round'>
				<path d='M19 12H5M12 5l-7 7 7 7' />
			</svg>
			Kembali
		</button>
	);

	const GradientText = ({ children, className = '' }) => (
		<h1
			className={`font-black tracking-tight ${className}`}
			style={{
				background: 'linear-gradient(135deg,#ec4899 0%,#a855f7 50%,#22d3ee 100%)',
				WebkitBackgroundClip: 'text',
				WebkitTextFillColor: 'transparent',
				filter: 'drop-shadow(0 0 20px rgba(236,72,153,0.4))',
			}}>
			{children}
		</h1>
	);

	// ── Render ─────────────────────────────────────────────────────────────────
	return (
		<div
			className='min-h-screen flex flex-col items-center justify-center overflow-hidden relative'
			style={{ background: 'radial-gradient(ellipse at 50% 40%, #0a0f2e 0%, #050b1e 100%)' }}>
			{/* Hidden webcam */}
			<video
				ref={videoRef}
				className='hidden'
				playsInline
				muted
			/>

			{/* ── MENU ───────────────────────────────────────────────────────────── */}
			{screen === 'menu' && (
				<div className='text-center flex flex-col items-center gap-6 px-6 py-10 max-w-lg w-full'>
					<GradientText className='text-5xl sm:text-7xl'>NEON HAND HOCKEY</GradientText>
					<p className='text-slate-400 text-base sm:text-lg'>Arahkan jari telunjukmu ke kamera — jarimu jadi pemukul!</p>

					{/* Requirements info */}
					<div className='w-full rounded-xl border border-slate-700/60 bg-slate-900/60 p-4 text-left text-sm text-slate-400 space-y-2'>
						<p className='font-semibold text-slate-300 mb-1'>Persyaratan:</p>
						<div className='flex items-start gap-2'>
							<span>📷</span>
							<span>
								Izin akses <strong className='text-white'>kamera</strong> di browser
							</span>
						</div>
						<div className='flex items-start gap-2'>
							<span>🌐</span>
							<span>
								Koneksi <strong className='text-white'>internet</strong> (model AI ~10 MB, di-cache setelah unduh pertama)
							</span>
						</div>
						<div className='flex items-start gap-2'>
							<span>🖥️</span>
							<span>
								Disarankan di <strong className='text-white'>Chrome / Edge</strong> versi terbaru
							</span>
						</div>
					</div>

					<div className='flex flex-wrap gap-4 justify-center w-full'>
						<button
							onClick={() => startGame('ai')}
							className='flex-1 min-w-[160px] px-8 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 text-white'
							style={{ background: 'linear-gradient(135deg,#ec4899,#9333ea)', boxShadow: '0 0 25px rgba(236,72,153,0.45)' }}>
							🤖&nbsp;&nbsp;1 Player vs AI
						</button>
						<button
							onClick={() => startGame('p2')}
							className='flex-1 min-w-[160px] px-8 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95'
							style={{ background: 'linear-gradient(135deg,#0ea5e9,#22d3ee)', boxShadow: '0 0 25px rgba(34,211,238,0.4)', color: '#0c1a2e' }}>
							👥&nbsp;&nbsp;2 Players
						</button>
					</div>
					<BtnBack />
				</div>
			)}

			{/* ── LOADING ────────────────────────────────────────────────────────── */}
			{screen === 'loading' && (
				<div className='text-center flex flex-col items-center gap-6 text-white px-6 max-w-sm w-full'>
					<div
						className='w-16 h-16 rounded-full border-4 animate-spin'
						style={{ borderColor: '#334155', borderTopColor: '#ec4899' }}
					/>
					<p className='text-xl font-bold font-mono animate-pulse'>{loadingMsg}</p>
					{/* Step indicator */}
					<div className='flex gap-2'>
						{[1, 2, 3, 4].map((s) => (
							<div
								key={s}
								className='w-2 h-2 rounded-full transition-all duration-300'
								style={{ background: s <= loadingStep ? '#ec4899' : '#334155' }}
							/>
						))}
					</div>
					<p className='text-slate-500 text-xs'>Jangan tutup halaman ini. Model AI hanya diunduh sekali.</p>
				</div>
			)}

			{/* ── ERROR ──────────────────────────────────────────────────────────── */}
			{screen === 'error' && (
				<div className='flex flex-col items-center gap-6 px-6 py-10 max-w-md w-full text-center'>
					<div className='text-5xl'>⚠️</div>
					<h2 className='text-2xl font-black text-white'>{errorInfo.title}</h2>
					<p className='text-slate-400 text-sm'>{errorInfo.body}</p>
					{/* Hint box */}
					<div className='w-full rounded-xl border border-amber-500/40 bg-amber-900/20 p-4 text-left text-sm text-amber-300'>
						<p className='font-semibold mb-1'>💡 Cara memperbaiki:</p>
						<p>{errorInfo.hint}</p>
					</div>
					<div className='flex gap-3 flex-wrap justify-center'>
						<button
							onClick={() => startGame(gameModeRef.current)}
							className='px-8 py-3 rounded-full font-bold text-sm text-white transition-all active:scale-95'
							style={{ background: 'linear-gradient(135deg,#ec4899,#9333ea)' }}>
							🔄 Coba Lagi
						</button>
						<button
							onClick={() => setScreen('menu')}
							className='px-8 py-3 rounded-full font-bold text-sm text-slate-300 border border-slate-600 hover:bg-slate-800 transition-all active:scale-95'>
							Kembali ke Menu
						</button>
					</div>
					<BtnBack />
				</div>
			)}

			{/* ── PLAYING / GAMEOVER ─────────────────────────────────────────────── */}
			{(screen === 'playing' || screen === 'gameover') && (
				<div className='flex flex-col items-center gap-3 w-full px-2'>
					{/* Top bar with back button */}
					<div className='flex w-full max-w-[1000px] items-center justify-between px-1'>
						<BtnBack />
						<span className='text-xs text-slate-600 font-mono'>NEON HAND HOCKEY</span>
						<span className='text-xs text-slate-600'>{gameModeRef.current === 'ai' ? '1P vs AI' : '2 Players'}</span>
					</div>

					{/* Game canvas wrapper */}
					<div
						className='relative rounded-2xl overflow-hidden'
						style={{
							width: 'min(1000px, 98vw)',
							aspectRatio: '1000/600',
							boxShadow: '0 0 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)',
						}}>
						{/* Scoreboard */}
						<div className='absolute top-0 left-0 right-0 flex justify-between items-center px-8 pt-5 z-20 pointer-events-none'>
							<span
								className='text-5xl font-black'
								style={{ color: '#ec4899', textShadow: '0 0 15px #ec4899' }}>
								{scores.p1}
							</span>
							<span className='text-xs tracking-[0.25em] text-slate-400 uppercase bg-black/50 px-4 py-1 rounded-full border border-slate-700'>First to 5</span>
							<span
								className='text-5xl font-black'
								style={{ color: '#22d3ee', textShadow: '0 0 15px #22d3ee' }}>
								{scores.p2}
							</span>
						</div>

						<canvas
							ref={canvasRef}
							width={1000}
							height={600}
							className='w-full h-full block'
						/>

						{/* Game Over overlay */}
						{screen === 'gameover' && (
							<div
								className='absolute inset-0 z-30 flex flex-col items-center justify-center gap-8'
								style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}>
								<h2
									className='text-5xl sm:text-7xl font-black text-center'
									style={{
										color: winner === 1 ? '#ec4899' : '#22d3ee',
										textShadow: `0 0 30px ${winner === 1 ? '#ec4899' : '#22d3ee'}`,
									}}>
									{winner === 1 ? 'PLAYER 1' : gameModeRef.current === 'ai' ? 'AI' : 'PLAYER 2'} WINS!
								</h2>
								<div className='flex gap-4 flex-wrap justify-center'>
									<button
										onClick={() => startGame(gameModeRef.current)}
										className='px-10 py-3 rounded-full font-bold text-slate-900 transition-all hover:brightness-110 active:scale-95'
										style={{ background: '#facc15', boxShadow: '0 0 20px rgba(250,204,21,0.5)' }}>
										REMATCH
									</button>
									<button
										onClick={() => {
											stopEverything();
											setScreen('menu');
										}}
										className='px-10 py-3 rounded-full font-bold text-white border border-slate-600 hover:bg-slate-800 transition-all active:scale-95'>
										MENU
									</button>
									<button
										onClick={goBack}
										className='px-10 py-3 rounded-full font-bold text-slate-400 border border-slate-700 hover:bg-slate-800 transition-all active:scale-95'>
										Keluar
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
