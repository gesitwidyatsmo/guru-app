"use client";
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, RotateCcw, Play, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import HandsOverlay from './HandsOverlay';

const KEY_ZONES = {
	'`': '#FF90E8', '1': '#FF90E8', 'q': '#FF90E8', 'a': '#FF90E8', 'z': '#FF90E8', 'ShiftLeft': '#FF90E8', 'Tab': '#FF90E8', 'CapsLock': '#FF90E8',
	'2': '#2F80ED', 'w': '#2F80ED', 's': '#2F80ED', 'x': '#2F80ED',
	'3': '#A3E635', 'e': '#A3E635', 'd': '#A3E635', 'c': '#A3E635',
	'4': '#F5C518', '5': '#F5C518', 'r': '#F5C518', 't': '#F5C518', 'f': '#F5C518', 'g': '#F5C518', 'v': '#F5C518', 'b': '#F5C518',
	' ': '#E5E7EB',
	'6': '#E8451A', '7': '#E8451A', 'y': '#E8451A', 'u': '#E8451A', 'h': '#E8451A', 'j': '#E8451A', 'n': '#E8451A', 'm': '#E8451A',
	'8': '#FF4545', 'i': '#FF4545', 'k': '#FF4545', ',': '#FF4545',
	'9': '#9333EA', 'o': '#9333EA', 'l': '#9333EA', '.': '#9333EA',
	'0': '#00A693', '-': '#00A693', '=': '#00A693', 'p': '#00A693', '[': '#00A693', ']': '#00A693', '\\': '#00A693', ';': '#00A693', "'": '#00A693', '/': '#00A693', 'Backspace': '#00A693', 'Enter': '#00A693', 'ShiftRight': '#00A693'
};

const KEYBOARD_LAYOUT = [
	[
		{ id: '`', label: '`' }, { id: '1', label: '1' }, { id: '2', label: '2' }, { id: '3', label: '3' }, { id: '4', label: '4' }, { id: '5', label: '5' }, { id: '6', label: '6' }, { id: '7', label: '7' }, { id: '8', label: '8' }, { id: '9', label: '9' }, { id: '0', label: '0' }, { id: '-', label: '-' }, { id: '=', label: '=' }, { id: 'Backspace', label: 'Backspace', flex: 2 }
	],
	[
		{ id: 'Tab', label: 'Tab', flex: 1.5 }, { id: 'q', label: 'Q' }, { id: 'w', label: 'W' }, { id: 'e', label: 'E' }, { id: 'r', label: 'R' }, { id: 't', label: 'T' }, { id: 'y', label: 'Y' }, { id: 'u', label: 'U' }, { id: 'i', label: 'I' }, { id: 'o', label: 'O' }, { id: 'p', label: 'P' }, { id: '[', label: '[' }, { id: ']', label: ']' }, { id: '\\', label: '\\', flex: 1.5 }
	],
	[
		{ id: 'CapsLock', label: 'Caps', flex: 1.75 }, { id: 'a', label: 'A' }, { id: 's', label: 'S' }, { id: 'd', label: 'D' }, { id: 'f', label: 'F' }, { id: 'g', label: 'G' }, { id: 'h', label: 'H' }, { id: 'j', label: 'J' }, { id: 'k', label: 'K' }, { id: 'l', label: 'L' }, { id: ';', label: ';' }, { id: "'", label: "'" }, { id: 'Enter', label: 'Enter', flex: 2.25 }
	],
	[
		{ id: 'ShiftLeft', label: 'Shift', flex: 2.5 }, { id: 'z', label: 'Z' }, { id: 'x', label: 'X' }, { id: 'c', label: 'C' }, { id: 'v', label: 'V' }, { id: 'b', label: 'B' }, { id: 'n', label: 'N' }, { id: 'm', label: 'M' }, { id: ',', label: ',' }, { id: '.', label: '.' }, { id: '/', label: '/' }, { id: 'ShiftRight', label: 'Shift', flex: 2.5 }
	],
	[
		{ id: ' ', label: 'SPACE', flex: 10 }
	]
];

const LEVELS = [
	{ id: 1, title: 'Level 1: Home Row (Left)', text: 'asdf asdf asdf asdf fds fds as as df df asdf' },
	{ id: 2, title: 'Level 2: Home Row (Right)', text: 'jkl; jkl; jkl; jkl; l;k l;k jkl; jkl;' },
	{ id: 3, title: 'Level 3: Full Home Row', text: 'asdf jkl; asdf jkl; fdsa ;lkj asdf jkl;' },
	{ id: 4, title: 'Level 4: Home Row + E & I', text: 'asdf jkl; e i asdf jkl; e i asdf jkl;' },
	{ id: 5, title: 'Level 5: Top Row', text: 'qwer tyuiop qwer tyuiop qwer tyuiop' },
	{ id: 6, title: 'Level 6: Bottom Row', text: 'zxcv bnm zxcv bnm zxcv bnm zxcv bnm' },
	{ id: 7, title: 'Level 7: Full Keyboard', text: 'the quick brown fox jumps over the lazy dog' }
];

export default function TypingGame() {
	const [currentLevel, setCurrentLevel] = useState(0);
	const [typedText, setTypedText] = useState('');
	const [status, setStatus] = useState('idle'); // idle | playing | finished
	const [startTime, setStartTime] = useState(null);
	const [endTime, setEndTime] = useState(null);
	const [currentTime, setCurrentTime] = useState(null);
	const [errors, setErrors] = useState(0);
	const [shakeKey, setShakeKey] = useState(null);
	const [pressedKey, setPressedKey] = useState(null);

	const text = LEVELS[currentLevel].text;
	const activeChar = status === 'finished' ? null : text[typedText.length];
	
	// Normalize active char for keyboard mapping
	const activeKeyId = activeChar === ' ' ? ' ' : activeChar?.toLowerCase();
	const activeColor = KEY_ZONES[activeKeyId] || '#FFFFFF';

	const inputRef = useRef(null);

	// Focus a hidden input to capture keystrokes on mobile or desktop without global listener issues
	useEffect(() => {
		if (status === 'playing' && inputRef.current) {
			inputRef.current.focus();
		}
	}, [status]);

	// Global keydown handler
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (status === 'finished') return;
			
			// Prevent default for space and single quotes so page doesn't scroll/find
			if (e.key === ' ' || e.key === "'") {
				e.preventDefault();
			}

			// Ignore modifier keys
			if (['Shift', 'Control', 'Alt', 'Meta', 'Tab', 'CapsLock', 'Enter'].includes(e.key)) {
				setPressedKey(e.code === 'ShiftLeft' ? 'ShiftLeft' : e.code === 'ShiftRight' ? 'ShiftRight' : e.key);
				setTimeout(() => setPressedKey(null), 150);
				return;
			}
			
			if (e.key === 'Backspace') {
				setPressedKey('Backspace');
				setTimeout(() => setPressedKey(null), 150);
				return;
			}

			if (status === 'idle') {
				setStatus('playing');
				const now = Date.now();
				setStartTime(now);
				setCurrentTime(now);
			}

			const expectedChar = text[typedText.length];
			
			// Map visual pressed key
			const visualKey = e.key === ' ' ? ' ' : e.key.toLowerCase();
			setPressedKey(visualKey);
			setTimeout(() => setPressedKey(null), 150);

			if (e.key === expectedChar) {
				const nextTyped = typedText + e.key;
				setTypedText(nextTyped);
				
				if (nextTyped === text) {
					setStatus('finished');
					setEndTime(Date.now());
				}
			} else {
				setErrors((prev) => prev + 1);
				setShakeKey(visualKey);
				setTimeout(() => setShakeKey(null), 300);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [status, typedText, text]);

	// Timer for live stats update
	useEffect(() => {
		let interval;
		if (status === 'playing') {
			interval = setInterval(() => {
				setCurrentTime(Date.now());
			}, 1000);
		}
		return () => clearInterval(interval);
	}, [status]);

	const handleReset = () => {
		setTypedText('');
		setStatus('idle');
		setStartTime(null);
		setEndTime(null);
		setCurrentTime(null);
		setErrors(0);
	};

	const handleNextLevel = () => {
		if (currentLevel < LEVELS.length - 1) {
			setCurrentLevel(currentLevel + 1);
			handleReset();
		}
	};

	const handleLevelSelect = (idx) => {
		setCurrentLevel(idx);
		handleReset();
	};

	// Calculate Stats
	const timeElapsed = startTime && currentTime ? ((endTime || currentTime) - startTime) / 1000 : 0;
	const minutes = timeElapsed / 60;
	const words = typedText.length / 5;
	const wpm = minutes > 0 ? Math.round(words / minutes) : 0;
	const accuracy = typedText.length > 0 ? Math.max(0, Math.round(((typedText.length - errors) / typedText.length) * 100)) : 100;

	return (
		<div className="w-full max-w-6xl mx-auto p-4 md:p-8 font-sans pb-24">
			
			{/* Header */}
			<div className='flex flex-col md:flex-row items-center justify-between mb-8 gap-4'>
				<div className="flex items-center gap-4 w-full md:w-auto">
					<Link href="/"
						className='p-3 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all flex items-center justify-center shrink-0'>
						<ChevronLeft className='w-6 h-6 text-[#0D0D0D]' strokeWidth={3} />
					</Link>
					<div className='bg-[#A3E635] p-2 border-[3px] border-[#0D0D0D] -rotate-1 shadow-[4px_4px_0px_0px_#0D0D0D] flex-1 md:flex-none text-center'>
						<h1 className='text-xl md:text-2xl font-black text-[#0D0D0D] uppercase tracking-wider'>Typing Game</h1>
					</div>
				</div>

				{/* Level Selector */}
				<div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 max-w-full no-scrollbar px-1">
					{LEVELS.map((lvl, idx) => (
						<button 
							key={lvl.id}
							onClick={() => handleLevelSelect(idx)}
							className={`px-3 py-2 border-[3px] border-[#0D0D0D] font-bold whitespace-nowrap transition-all shadow-[3px_3px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[5px_5px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none
								${currentLevel === idx ? 'bg-[#FF90E8] scale-105 rotate-1' : 'bg-white'}`}
						>
							{lvl.id}
						</button>
					))}
				</div>
			</div>

			{/* Main Grid */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
				
				{/* Left Column: Game Area */}
				<div className="lg:col-span-8 flex flex-col gap-6">
					
					{/* Text Display Card */}
					<div className="bg-white border-[4px] border-[#0D0D0D] p-6 shadow-[8px_8px_0px_0px_#0D0D0D] relative overflow-hidden">
						<div className="absolute top-2 right-4 text-sm font-bold text-gray-400 uppercase tracking-widest">{LEVELS[currentLevel].title}</div>
						<div className="text-3xl md:text-5xl font-mono font-bold mt-4 leading-relaxed tracking-wide text-gray-300 break-words relative z-10" style={{ wordSpacing: '0.3em' }}>
							{text.split('').map((char, index) => {
								const isTyped = index < typedText.length;
								const isActive = index === typedText.length;
								let colorClass = 'text-gray-300';
								if (isTyped) colorClass = 'text-[#0D0D0D]';
								
								return (
									<span key={index} className="relative inline-block">
										<span className={`${colorClass} ${isActive ? 'opacity-0' : ''}`}>
											{char === ' ' ? '\u00A0' : char}
										</span>
										
										{/* Active character with colorful highlight */}
										{isActive && (
											<span 
												className="absolute inset-0 flex items-center justify-center animate-pulse" 
												style={{ 
													backgroundColor: status === 'finished' ? 'transparent' : activeColor, 
													color: char === ' ' ? 'transparent' : '#0D0D0D',
													borderBottom: `4px solid #0D0D0D`,
													borderRadius: '4px',
													padding: '0 2px',
													margin: '0 -2px'
												}}
											>
												{char === ' ' ? '\u00A0' : char}
											</span>
										)}
									</span>
								);
							})}
						</div>

						{status === 'idle' && (
							<div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
								<div className="bg-[#F5C518] px-6 py-3 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rotate-2 flex items-center gap-3 animate-bounce">
									<Play className="w-6 h-6" strokeWidth={3}/>
									<span className="font-black text-xl uppercase">Mulai Mengetik!</span>
								</div>
							</div>
						)}
					</div>

					{/* Keyboard Component with Hands Overlay */}
					<div className="bg-[#E5E7EB] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] p-3 md:p-6 select-none relative overflow-hidden">
						<div className="min-w-[600px] flex flex-col gap-2 relative z-10">
							{KEYBOARD_LAYOUT.map((row, rowIndex) => (
								<div key={rowIndex} className="flex gap-2 w-full justify-center">
									{row.map((key) => {
										const isActiveTarget = key.id === activeKeyId;
										const isPressed = pressedKey === key.id;
										const isShake = shakeKey === key.id;
										const zoneColor = KEY_ZONES[key.id] || '#FFFFFF';
										
										// Determine styles based on state
										let bgColor = '#FFFFFF';
										if (isActiveTarget) bgColor = zoneColor;
										if (isPressed) bgColor = zoneColor; // highlight on press too

										return (
											<div 
												key={key.id}
												className={`
													flex items-center justify-center font-bold font-mono text-sm md:text-base border-[2px] border-[#0D0D0D] rounded-md transition-all duration-100
													${isActiveTarget ? 'shadow-[0_0_0_2px_#0D0D0D,0_0_15px_rgba(0,0,0,0.2)] scale-105 z-10' : 'shadow-[2px_2px_0px_0px_#0D0D0D]'}
													${isPressed ? 'translate-y-1 shadow-none bg-opacity-80 scale-95' : ''}
													${isShake ? 'animate-[shake_0.3s_ease-in-out_1]' : ''}
												`}
												style={{ 
													flex: key.flex || 1, 
													height: '48px',
													backgroundColor: bgColor,
													color: (isActiveTarget || isPressed) ? (zoneColor === '#00A693' || zoneColor === '#E8451A' || zoneColor === '#FF4545' || zoneColor === '#9333EA' || zoneColor === '#2F80ED' ? '#FFFFFF' : '#0D0D0D') : '#0D0D0D'
												}}
											>
												{key.label}
											</div>
										);
									})}
								</div>
							))}
						</div>
						
						{/* Overlay Tangan di atas Keyboard */}
						<HandsOverlay activeKeyId={activeKeyId} activeColor={activeColor} />
					</div>
					
					{/* Mobile Warning */}
					<div className="md:hidden bg-[#FF4545] border-[3px] border-[#0D0D0D] p-3 text-white font-bold text-sm text-center shadow-[4px_4px_0px_0px_#0D0D0D] mt-2">
						⚠️ Gunakan keyboard fisik atau mode desktop untuk pengalaman terbaik.
					</div>
				</div>

				{/* Right Column: Stats & Guide */}
				<div className="lg:col-span-4 flex flex-col gap-6">
					
					{/* Stats Card */}
					<div className="bg-[#2F80ED] border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] p-6 text-white rotate-1">
						<h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-[#0D0D0D] pb-2 mb-4 drop-shadow-[2px_2px_0px_#0D0D0D]">Live Stats</h2>
						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] p-3 text-center text-[#0D0D0D]">
								<div className="text-sm font-bold uppercase">WPM</div>
								<div className="text-3xl font-black">{status === 'idle' ? '-' : wpm}</div>
							</div>
							<div className="bg-white border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] p-3 text-center text-[#0D0D0D]">
								<div className="text-sm font-bold uppercase">Akurasi</div>
								<div className="text-3xl font-black">{status === 'idle' ? '-' : `${accuracy}%`}</div>
							</div>
							<div className="bg-[#FF90E8] border-[3px] border-[#0D0D0D] shadow-[3px_3px_0px_0px_#0D0D0D] p-3 text-center text-[#0D0D0D] col-span-2">
								<div className="text-sm font-bold uppercase">Errors</div>
								<div className="text-2xl font-black">{errors}</div>
							</div>
						</div>

						<button 
							onClick={handleReset}
							className="mt-6 w-full bg-[#E5E7EB] border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-bold py-3 uppercase shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
						>
							<RotateCcw className="w-5 h-5" strokeWidth={3}/> Reset Latihan
						</button>
					</div>

				</div>
			</div>

			{/* Results Modal */}
			{status === 'finished' && (
				<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
					<div className="bg-[#A3E635] border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] p-8 max-w-lg w-full text-center relative rotate-1 animate-in zoom-in duration-300">
						<div className="absolute -top-6 -right-6 bg-white p-2 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] rotate-12">
							<CheckCircle2 className="w-12 h-12 text-[#A3E635]" strokeWidth={3} />
						</div>
						
						<h2 className="text-4xl font-black uppercase text-[#0D0D0D] mb-2 drop-shadow-[2px_2px_0px_#FFF]">Level Selesai!</h2>
						<p className="font-bold text-lg mb-8">{LEVELS[currentLevel].title}</p>
						
						<div className="grid grid-cols-2 gap-4 mb-8">
							<div className="bg-white border-[3px] border-[#0D0D0D] p-4 shadow-[4px_4px_0px_0px_#0D0D0D]">
								<div className="text-sm font-bold uppercase text-gray-500">Kecepatan</div>
								<div className="text-4xl font-black text-[#2F80ED]">{wpm} <span className="text-base text-black">WPM</span></div>
							</div>
							<div className="bg-white border-[3px] border-[#0D0D0D] p-4 shadow-[4px_4px_0px_0px_#0D0D0D]">
								<div className="text-sm font-bold uppercase text-gray-500">Akurasi</div>
								<div className="text-4xl font-black text-[#E8451A]">{accuracy}%</div>
							</div>
						</div>

						<div className="flex flex-col sm:flex-row gap-4">
							<button 
								onClick={handleReset}
								className="flex-1 bg-white border-[3px] border-[#0D0D0D] text-[#0D0D0D] font-black py-4 uppercase shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all"
							>
								Ulangi
							</button>
							{currentLevel < LEVELS.length - 1 && (
								<button 
									onClick={handleNextLevel}
									className="flex-1 bg-[#0D0D0D] border-[3px] border-[#0D0D0D] text-white font-black py-4 uppercase shadow-[4px_4px_0px_0px_#FFFFFF] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#FFFFFF] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2"
								>
									Lanjut <ArrowRight strokeWidth={3}/>
								</button>
							)}
						</div>
					</div>
				</div>
			)}
			
			<style dangerouslySetInnerHTML={{__html: `
				@keyframes shake {
					0%, 100% { transform: translateX(0); }
					25% { transform: translateX(-4px); }
					75% { transform: translateX(4px); }
				}
			`}} />
		</div>
	);
}
