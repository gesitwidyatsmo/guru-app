import React from 'react';
import TypingGame from './TypingGame';

export const metadata = {
	title: 'Belajar Mengetik | Guru App',
	description: 'Latihan mengetik 10 jari interaktif',
};

export default function TypingPage() {
	return (
		<main className="min-h-screen bg-[#FFF5F0] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiMwMDAwMDAiIGZpbGwtb3BhY2l0eT0iMC4xIi8+PC9zdmc+')] font-sans">
			<TypingGame />
		</main>
	);
}
