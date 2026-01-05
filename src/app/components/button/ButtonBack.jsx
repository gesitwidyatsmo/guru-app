import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React from 'react';

const ButtonBack = () => {
	const router = useRouter();

	return (
		<button
			className='text-center w-32 rounded-2xl h-12 gap-2 text-black text-md font-semibold group flex items-center cursor-pointer'
			type='button'
			onClick={() => router.back()}>
			<ArrowLeft />
			Kembali
		</button>
	);
};

export default ButtonBack;
