// src/app/Grup/page.js
'use client';
import { useState } from 'react';
import SectionHeader from '../components/SectionHeader'; // gunakan path absolut (butuh support jsconfig.json/tsconfig.json)
import Loader from '../components/loading';

export default function Page() {
	const handleBack = () => window.history.back();
	const handleAdd = () => alert('Tambah Grup diklik!');
	const [loading, setLoading] = useState(true);

	if (loading) {
		return (
			<div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center'>
				<div className='text-center'>
					<Loader />
				</div>
			</div>
		);
	}

	return (
		<div>
			<SectionHeader
				title='Grup'
				leftIcon={
					<svg
						width='24'
						height='24'
						fill='none'
						stroke='currentColor'
						strokeWidth={2}>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M15 19l-7-7 7-7'
						/>
					</svg>
				}
				onLeftClick={handleBack}
				rightIcon={<span className='text-xl'>＋</span>}
				onRightClick={handleAdd}
			/>
			{/* ...konten lain */}
		</div>
	);
}
