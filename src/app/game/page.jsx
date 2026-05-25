"use client";
import React from 'react';
import Link from 'next/link';

export default function GameMenu() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-pink-500">
        Game Arcade
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl w-full">
        {/* Card for Neon Hand Hockey */}
        <Link href="/game/hand-hockey">
          <div className="group relative overflow-hidden rounded-2xl bg-slate-800 border border-slate-700 hover:border-cyan-500 transition-all duration-300 cursor-pointer h-64 flex flex-col items-center justify-center">
            {/* Neon Glow background effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            
            <div className="z-10 text-center flex flex-col items-center">
              <div className="w-20 h-20 mb-4 rounded-full border-4 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.5)] flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]"></div>
              </div>
              <h2 className="text-2xl font-bold text-white group-hover:text-cyan-400 transition-colors">Neon Hand Hockey</h2>
              <p className="text-slate-400 mt-2 text-sm px-6">Mainkan Air Hockey menggunakan kamera dan jarimu sebagai pemukul!</p>
            </div>
          </div>
        </Link>
        
        {/* Placeholder for future games */}
        <div className="rounded-2xl bg-slate-800/50 border border-slate-700/50 h-64 flex flex-col items-center justify-center border-dashed">
          <p className="text-slate-500 font-medium">Coming Soon...</p>
        </div>
      </div>
    </div>
  );
}
