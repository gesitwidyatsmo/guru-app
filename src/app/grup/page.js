// src/app/Grup/page.js
'use client';
import SectionHeader from '../components/SectionHeader'; // gunakan path absolut (butuh support jsconfig.json/tsconfig.json)

export default function Page() {
	const handleBack = () => window.history.back();
	const handleAdd = () => alert('Tambah Grup diklik!');

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
