"use client";
import React, { useState } from 'react';
import { ChevronLeft, Gamepad2, Users, ArrowRight, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function GameMenu() {
	const router = useRouter();
	const [showArisanModal, setShowArisanModal] = useState(false);

	const handleArisanClick = () => {
		setShowArisanModal(true);
	};

	const handlePlayArisan = () => {
		setShowArisanModal(false);
		router.push('/game/arisan');
	};

	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] p-6 md:p-12 flex flex-col items-center font-sans'>
			
			<div className='w-full max-w-5xl flex items-center justify-between mb-12'>
				<button
					onClick={() => window.history.back()}
					className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
					<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
				</button>
				
				<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-2 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>ARCADE GAME</h1>
				</div>
			</div>

			<div className='w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8'>
				
				{/* Card Arisan */}
				<div 
					onClick={handleArisanClick}
					className='cursor-pointer group relative bg-[#FF90E8] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:shadow-[12px_12px_0px_0px_#0D0D0D] hover:-translate-y-2 transition-all p-8 flex flex-col items-center text-center'>
					<div className='bg-white p-4 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] mb-6 group-hover:rotate-12 transition-transform'>
						<Users className='w-16 h-16 text-[#0D0D0D]' strokeWidth={2.5} />
					</div>
					<h2 className='text-3xl font-black text-[#0D0D0D] uppercase tracking-widest mb-3 bg-white px-4 py-1 border-[3px] border-[#0D0D0D] rotate-1'>
						ARISAN
					</h2>
					<p className='text-lg font-bold text-[#0D0D0D] mt-2 bg-white/80 p-2 border-2 border-[#0D0D0D]'>
						Games, Kuis & Tantangan Seru!
					</p>
				</div>

				{/* Card Hand Hockey */}
				<Link href="/game/hand-hockey" className='block'>
					<div className='group relative bg-[#2F80ED] border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] hover:shadow-[12px_12px_0px_0px_#0D0D0D] hover:-translate-y-2 transition-all p-8 flex flex-col items-center text-center h-full'>
						<div className='bg-white p-4 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] mb-6 group-hover:-rotate-12 transition-transform'>
							<Gamepad2 className='w-16 h-16 text-[#0D0D0D]' strokeWidth={2.5} />
						</div>
						<h2 className='text-3xl font-black text-[#0D0D0D] uppercase tracking-widest mb-3 bg-white px-4 py-1 border-[3px] border-[#0D0D0D] -rotate-1'>
							HAND HOCKEY
						</h2>
						<p className='text-lg font-bold text-[#0D0D0D] mt-2 bg-white/80 p-2 border-2 border-[#0D0D0D]'>
							Game klasik hoki tangan
						</p>
					</div>
				</Link>

			</div>

			{/* Modal Arisan */}
			{showArisanModal && (
				<div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
					<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] max-w-2xl w-full p-8 relative animate-in zoom-in duration-200'>
						<button 
							onClick={() => setShowArisanModal(false)}
							className='absolute -top-4 -right-4 bg-[#FF4545] p-2 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] transition-all'>
							<X className='w-6 h-6 text-white' strokeWidth={3} />
						</button>

						<div className='bg-[#F5C518] p-4 border-[4px] border-[#0D0D0D] inline-block mb-6 -rotate-2 shadow-[4px_4px_0px_0px_#0D0D0D]'>
							<h2 className='text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>TENTANG ARISAN</h2>
						</div>

						<div className='space-y-4 mb-8 text-lg font-medium text-gray-800 border-l-[4px] border-[#2F80ED] pl-4'>
							<p>
								<strong className='text-black text-xl'>Arisan</strong> adalah game interaktif yang terinspirasi dari program acara TV!
							</p>
							<p>
								Di sini kamu akan menemukan berbagai macam hiburan seru seperti:
							</p>
							<ul className='list-disc pl-6 space-y-2 font-bold text-black'>
								<li>Roda Keberuntungan (Spin Wheel)</li>
								<li>Kuis Kilat & Pengetahuan Umum</li>
								<li>Tantangan Truth or Dare</li>
								<li>Tebak Gaya & Tebak Kata</li>
							</ul>
							<p className='pt-2'>
								Cocok dimainkan bersama-sama di kelas untuk ice-breaking dan seru-seruan!
							</p>
						</div>

						<button 
							onClick={handlePlayArisan}
							className='w-full bg-[#A3E635] py-4 border-[4px] border-[#0D0D0D] shadow-[6px_6px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_#0D0D0D] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 text-2xl font-black uppercase tracking-wider text-[#0D0D0D]'>
							Mainkan Sekarang <ArrowRight strokeWidth={3} />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
