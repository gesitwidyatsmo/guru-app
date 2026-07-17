"use client";
import React from 'react';
import { ChevronLeft, Construction } from 'lucide-react';

export default function GameMenu() {
	return (
		<div className='min-h-screen bg-[#FFF5F0] bg-[url("data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+")] p-6 md:p-12 flex flex-col items-center font-sans'>
			
			<div className='w-full max-w-4xl flex items-center justify-between mb-12'>
				<button
					onClick={() => window.history.back()}
					className='p-4 bg-white border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_#0D0D0D] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all rounded-none'>
					<ChevronLeft className='w-8 h-8 text-[#0D0D0D]' strokeWidth={3} />
				</button>
				
				<div className='bg-[#A3E635] p-3 border-[4px] border-[#0D0D0D] rotate-2 inline-block shadow-[4px_4px_0px_0px_#0D0D0D]'>
					<h1 className='text-2xl sm:text-3xl font-black text-[#0D0D0D] uppercase tracking-widest'>ARCADE GAME</h1>
				</div>
			</div>

			<div className='relative w-full max-w-2xl mt-10 flex flex-col items-center justify-center'>
				{/* Background decorative blocks */}
				<div className='absolute -top-10 -right-5 w-32 h-32 bg-[#FF90E8] border-[4px] border-[#0D0D0D] rotate-12 z-0'></div>
				<div className='absolute -bottom-8 -left-8 w-24 h-24 bg-[#2F80ED] border-[4px] border-[#0D0D0D] -rotate-12 z-0'></div>
				
				{/* Main Card */}
				<div className='bg-white border-[4px] border-[#0D0D0D] shadow-[12px_12px_0px_0px_#0D0D0D] p-10 md:p-16 flex flex-col items-center justify-center text-center relative z-10 w-full rounded-none rotate-1 hover:rotate-0 transition-all'>
					
					<div className='bg-[#F5C518] p-5 border-[4px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] -rotate-3 mb-8'>
						<Construction className='w-16 h-16 text-[#0D0D0D]' strokeWidth={3} />
					</div>

					<h1 className='text-4xl md:text-6xl font-black text-[#0D0D0D] uppercase tracking-widest mb-4'>
						COMING SOON
					</h1>
					
					<p className='text-lg md:text-xl font-bold text-[#0D0D0D] uppercase tracking-widest bg-[#A3E635] px-4 py-2 border-[3px] border-[#0D0D0D] inline-block shadow-[2px_2px_0px_0px_#0D0D0D]'>
						ZONA PERMAINAN SEDANG DIBANGUN!
					</p>

				</div>
			</div>
		</div>
	);
}
