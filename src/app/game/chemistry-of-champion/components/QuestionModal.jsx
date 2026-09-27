"use client";
import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Award, CheckCircle2, AlertTriangle, Eye, EyeOff, RotateCcw, Sparkles } from 'lucide-react';
import { soundFX } from '../utils/audio';

export default function QuestionModal({
	question,
	teams,
	onClose,
	onClaimScore,
	onMarkSkipped
}) {
	const [timeLeft, setTimeLeft] = useState(45); // default 45 seconds per question
	const [isTimerRunning, setIsTimerRunning] = useState(true);
	const [showAnswer, setShowAnswer] = useState(false);
	const [selectedOption, setSelectedOption] = useState(null);
	const [pointMultiplier, setPointMultiplier] = useState(1);
	const timerRef = useRef(null);

	const initialTime = 45;

	// Question Timer effect
	useEffect(() => {
		if (isTimerRunning && timeLeft > 0) {
			timerRef.current = setInterval(() => {
				setTimeLeft((prev) => {
					if (prev <= 1) {
						clearInterval(timerRef.current);
						soundFX.playWrong();
						return 0;
					}
					if (prev <= 6) {
						soundFX.playTick(true);
					}
					return prev - 1;
				});
			}, 1000);
		}
		return () => clearInterval(timerRef.current);
	}, [isTimerRunning, timeLeft]);

	const handleOptionClick = (opt) => {
		soundFX.playClick();
		setSelectedOption(opt);
	};

	const handleToggleAnswer = () => {
		soundFX.playClick();
		setShowAnswer(!showAnswer);
	};

	const handleClaim = (teamKey) => {
		soundFX.playCorrect();
		const awardedPoints = (question?.points || 10) * pointMultiplier;
		onClaimScore(question.id, teamKey, awardedPoints);
	};

	const handleSkip = () => {
		soundFX.playWrong();
		onMarkSkipped(question.id);
	};

	const progressPercent = (timeLeft / initialTime) * 100;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
			<div className="relative w-full max-w-3xl bg-[#0F172A] border-2 border-cyan-500/40 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden flex flex-col text-slate-100 max-h-[90vh]">
				
				{/* Top Bar / Header */}
				<div className="bg-gradient-to-r from-slate-900 via-[#1E293B] to-slate-900 px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-black text-xl shadow-[0_0_15px_rgba(6,182,212,0.4)]">
							#{question.id}
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span className="text-xs uppercase font-bold tracking-widest text-cyan-400 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-800">
									{question.topic || 'Kimia Umum'}
								</span>
								<span className="text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800 flex items-center gap-1">
									<Sparkles className="w-3 h-3" /> {(question.points || 10) * pointMultiplier} Poin
								</span>
							</div>
							<h3 className="text-lg font-bold text-white tracking-wide mt-0.5">
								Arena Soal Nomor {question.id}
							</h3>
						</div>
					</div>

					{/* Timer Widget */}
					<div className="flex items-center gap-3">
						<button
							onClick={() => setIsTimerRunning(!isTimerRunning)}
							className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-mono font-bold transition-all shadow-inner ${
								timeLeft <= 10
									? 'bg-rose-500/20 text-rose-400 border-rose-500 animate-pulse'
									: 'bg-slate-800 text-cyan-300 border-cyan-500/40'
							}`}
							title="Klik untuk Jeda / Lanjut Timer"
						>
							<Clock className="w-4 h-4" />
							<span>{String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}</span>
						</button>

						<button
							onClick={() => {
								setTimeLeft(initialTime);
								setIsTimerRunning(true);
							}}
							className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
							title="Reset Timer"
						>
							<RotateCcw className="w-4 h-4" />
						</button>

						<button
							onClick={onClose}
							className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 transition"
						>
							<X className="w-5 h-5" />
						</button>
					</div>
				</div>

				{/* Progress Timer Bar */}
				<div className="w-full bg-slate-800 h-1.5 overflow-hidden">
					<div
						className={`h-full transition-all duration-1000 ${
							timeLeft <= 10 ? 'bg-rose-500' : 'bg-cyan-400'
						}`}
						style={{ width: `${progressPercent}%` }}
					/>
				</div>

				{/* Modal Body / Question Content */}
				<div className="p-6 md:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
					
					{/* Question Card */}
					<div className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-6 shadow-inner">
						<p className="text-xl md:text-2xl font-semibold leading-relaxed text-slate-100">
							{question.question}
						</p>
					</div>

					{/* Options (if available) */}
					{question.options && question.options.length > 0 && (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
							{question.options.map((opt, idx) => {
								const label = String.fromCharCode(65 + idx); // A, B, C, D, E
								const isSelected = selectedOption === opt;
								const isCorrect = showAnswer && opt === question.answer;
								const isWrong = showAnswer && isSelected && opt !== question.answer;

								let cardStyle = "bg-slate-800/80 border-slate-700 text-slate-200 hover:border-cyan-400/60 hover:bg-slate-700/60";
								if (isSelected && !showAnswer) {
									cardStyle = "bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-2 ring-cyan-500/40";
								} else if (isCorrect) {
									cardStyle = "bg-emerald-950/90 border-emerald-400 text-emerald-200 ring-2 ring-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.3)]";
								} else if (isWrong) {
									cardStyle = "bg-rose-950/80 border-rose-500 text-rose-300";
								}

								return (
									<button
										key={idx}
										onClick={() => handleOptionClick(opt)}
										className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 group cursor-pointer ${cardStyle}`}
									>
										<span className={`w-8 h-8 rounded-xl font-bold flex items-center justify-center shrink-0 transition text-sm ${
											isCorrect ? 'bg-emerald-500 text-black font-black' : isSelected ? 'bg-cyan-500 text-black' : 'bg-slate-700 text-cyan-300 group-hover:bg-cyan-500 group-hover:text-black'
										}`}>
											{label}
										</span>
										<span className="text-base font-medium leading-normal pt-0.5">
											{opt}
										</span>
									</button>
								);
							})}
						</div>
					)}

					{/* Reveal Answer Section */}
					<div className="pt-2">
						<button
							onClick={handleToggleAnswer}
							className="flex items-center gap-2 text-sm font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/50 hover:bg-cyan-900/50 px-4 py-2 rounded-xl border border-cyan-800 transition"
						>
							{showAnswer ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
							<span>{showAnswer ? 'Sembunyikan Kunci Jawaban' : 'Tampilkan Kunci Jawaban & Pembahasan'}</span>
						</button>

						{showAnswer && (
							<div className="mt-3 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 space-y-2 animate-in fade-in duration-200">
								<div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
									<CheckCircle2 className="w-5 h-5 text-emerald-400" />
									<span>KUNCI JAWABAN: {question.answer}</span>
								</div>
								{question.explanation && (
									<p className="text-xs md:text-sm text-slate-300 font-normal leading-relaxed pl-7">
										<strong className="text-emerald-300">Pembahasan:</strong> {question.explanation}
									</p>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Bottom Action / Score Claiming Bar */}
				<div className="bg-slate-900 px-6 py-4 border-t border-slate-700/80 space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-xs uppercase font-bold tracking-widest text-slate-400 flex items-center gap-1.5">
							<Award className="w-4 h-4 text-cyan-400" />
							Klaim Poin Untuk Tim Pemenang:
						</span>

						{/* Multiplier / Bonus Selector */}
						<div className="flex items-center gap-1.5 text-xs">
							<span className="text-slate-400">Pengali:</span>
							{[1, 1.5, 2].map((m) => (
								<button
									key={m}
									onClick={() => setPointMultiplier(m)}
									className={`px-2 py-0.5 rounded-md font-bold transition ${
										pointMultiplier === m
											? 'bg-cyan-500 text-black'
											: 'bg-slate-800 text-slate-400 hover:text-white'
									}`}
								>
									{m}x
								</button>
							))}
						</div>
					</div>

					{/* 6 Team Claim Buttons */}
					<div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
						{teams.map((team) => (
							<button
								key={team.id}
								onClick={() => handleClaim(team.id)}
								style={{
									borderColor: team.color,
									backgroundColor: `${team.color}15`,
									color: '#FFFFFF'
								}}
								className="py-2.5 px-2 rounded-xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-md group cursor-pointer"
							>
								<div className="flex items-center gap-1.5">
									<span
										className="w-2.5 h-2.5 rounded-full"
										style={{ backgroundColor: team.color }}
									/>
									<span className="uppercase truncate max-w-[80px]">{team.name}</span>
								</div>
								<span className="text-[10px] font-extrabold text-cyan-300">
									+{(question?.points || 10) * pointMultiplier} Poin
								</span>
							</button>
						))}
					</div>

					{/* Skip / Close controls */}
					<div className="flex items-center justify-between pt-1 text-xs">
						<button
							onClick={handleSkip}
							className="text-slate-400 hover:text-rose-400 px-3 py-1.5 rounded-lg border border-slate-700/80 hover:border-rose-500/50 hover:bg-rose-500/10 transition flex items-center gap-1.5"
						>
							<AlertTriangle className="w-3.5 h-3.5" />
							<span>Tandai Terlewati / Gagal</span>
						</button>

						<button
							onClick={onClose}
							className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
						>
							Tutup Tanpa Poin
						</button>
					</div>
				</div>

			</div>
		</div>
	);
}
