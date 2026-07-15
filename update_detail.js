const fs = require('fs');
const file = 'src/app/kelas/[id]/nilai/[tugasId]/page.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update setTugasData
const fetchPattern1 = "judul: firstData.kategori,\n\t\t\t\t\t\tmapel: firstData.mapel,";
const fetchReplacement1 = "judul: firstData.kategori,\n\t\t\t\t\t\ttype: firstData.type || 'Formatif',\n\t\t\t\t\t\tdeskripsi: firstData.deskripsi || '',\n\t\t\t\t\t\tmapel: firstData.mapel,";
content = content.replace(fetchPattern1, fetchReplacement1);

const fetchPattern2 = "judul: tugasHead.kategori,\n\t\t\t\t\t\t\tmapel: tugasHead.mapel,";
const fetchReplacement2 = "judul: tugasHead.kategori,\n\t\t\t\t\t\t\ttype: tugasHead.type || 'Formatif',\n\t\t\t\t\t\t\tdeskripsi: tugasHead.deskripsi || '',\n\t\t\t\t\t\t\tmapel: tugasHead.mapel,";
content = content.replace(fetchPattern2, fetchReplacement2);


// 2. Update UI
// Original UI:
/*
				<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div>
						<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-1 bg-white inline-block px-2 border-[2px] border-[#0D0D0D]'>JUDUL TUGAS</div>
						<div className='text-2xl md:text-3xl font-black text-[#0D0D0D] uppercase drop-shadow-[1px_1px_0px_#0D0D0D]'>{tugasData.judul}</div>
					</div>
					<div className='bg-white px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] self-start md:self-auto text-center'>
*/

const uiPattern = `<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row md:items-center justify-between gap-4'>
					<div>
						<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-1 bg-white inline-block px-2 border-[2px] border-[#0D0D0D]'>JUDUL TUGAS</div>
						<div className='text-2xl md:text-3xl font-black text-[#0D0D0D] uppercase drop-shadow-[1px_1px_0px_#0D0D0D]'>{tugasData.judul}</div>
					</div>
					<div className='bg-white px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] self-start md:self-auto text-center'>`;

const uiReplacement = `<div className='bg-[#F5C518] p-6 border-[4px] border-[#0D0D0D] shadow-[8px_8px_0px_0px_#0D0D0D] flex flex-col md:flex-row justify-between gap-6'>
					<div className='flex-1'>
						<div className='text-xs font-black text-[#0D0D0D] uppercase tracking-wider mb-2 bg-white inline-block px-2 border-[2px] border-[#0D0D0D]'>JUDUL TUGAS</div>
						<div className='flex flex-wrap items-center gap-3 mb-2'>
							<div className='text-2xl md:text-3xl font-black text-[#0D0D0D] uppercase drop-shadow-[1px_1px_0px_#0D0D0D]'>{tugasData.judul}</div>
							<div className='px-3 py-1 bg-[#00A693] text-white text-sm font-black border-[2px] border-[#0D0D0D] shadow-[2px_2px_0px_0px_#0D0D0D] -rotate-2'>{tugasData.type}</div>
						</div>
						{tugasData.deskripsi && (
							<div className='mt-4 p-4 bg-white border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D]'>
								<div className='text-[10px] font-black uppercase text-gray-500 mb-1'>DESKRIPSI</div>
								<p className='text-sm md:text-base font-medium text-[#0D0D0D]'>{tugasData.deskripsi}</p>
							</div>
						)}
					</div>
					<div className='bg-white px-4 py-2 border-[3px] border-[#0D0D0D] shadow-[4px_4px_0px_0px_#0D0D0D] self-start text-center min-w-[120px]'>`;

content = content.replace(uiPattern, uiReplacement);

fs.writeFileSync(file, content);
console.log('Detail page updated!');
