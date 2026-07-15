const fs = require('fs');
const file = 'src/app/kelas/[id]/nilai/[tugasId]/edit/page.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add state
const statePattern = "const [judul, setJudul] = useState('');";
const stateReplacement = "const [judul, setJudul] = useState('');\n\tconst [type, setType] = useState('Formatif');\n\tconst [deskripsi, setDeskripsi] = useState('');";
content = content.replace(statePattern, stateReplacement);

// 2. Fetch updates
const fetchPattern1 = "setJudul(firstData.kategori);";
const fetchReplacement1 = "setJudul(firstData.kategori);\n\t\t\t\t\tsetType(firstData.type || 'Formatif');\n\t\t\t\t\tsetDeskripsi(firstData.deskripsi || '');";
content = content.replace(fetchPattern1, fetchReplacement1);

const fetchPattern2 = "setJudul(tugasHead.kategori);";
const fetchReplacement2 = "setJudul(tugasHead.kategori);\n\t\t\t\t\t\tsetType(tugasHead.type || 'Formatif');\n\t\t\t\t\t\tsetDeskripsi(tugasHead.deskripsi || '');";
content = content.replace(fetchPattern2, fetchReplacement2);

// 3. Update query
const updatePattern = "const updates = { kategori: judul, tanggal: tanggal };";
const updateReplacement = "const updates = { kategori: judul, tanggal: tanggal, type, deskripsi };";
content = content.replace(updatePattern, updateReplacement);

// 4. Update UI
const uiStart = "<div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>";
const uiEnd = "</form>";

// We need to find where to put the new inputs.
// In edit/page.jsx, we have:
/*
								<div>
									<label className='input-label mb-2'>TANGGAL</label>
									<input type='date' required value={tanggal} onChange={(e) => setTanggal(e.target.value)} className='neo-input w-full' />
								</div>
							</div>
*/
const uiPattern = "onChange={(e) => setTanggal(e.target.value)} className='neo-input w-full' />\n\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t</div>";
const uiReplacement = `onChange={(e) => setTanggal(e.target.value)} className='neo-input w-full' />
								</div>
							</div>
							<div className='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
								<div>
									<label className='input-label mb-2'>TIPE TUGAS</label>
									<div className='relative'>
										<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='2.5' stroke='currentColor' className='absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-[#0D0D0D] pointer-events-none'>
											<path strokeLinecap='round' strokeLinejoin='round' d='M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z' />
											<path strokeLinecap='round' strokeLinejoin='round' d='M6 6h.008v.008H6V6Z' />
										</svg>
										<select value={type} onChange={(e) => setType(e.target.value)} className='neo-input neo-input-with-icon w-full appearance-none cursor-pointer bg-white'>
											<option value='Formatif'>Formatif</option>
											<option value='Sumatif'>Sumatif</option>
											<option value='SAS'>SAS</option>
											<option value='PTS'>PTS</option>
											<option value='PAS'>PAS</option>
										</select>
										<div className='absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none'>
											<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth='3' stroke='currentColor' className='w-5 h-5'>
												<path strokeLinecap='round' strokeLinejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5' />
											</svg>
										</div>
									</div>
								</div>
								<div>
									<label className='input-label mb-2'>DESKRIPSI (OPSIONAL)</label>
									<textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} placeholder='Contoh: BAB 1 Eksponen' className='neo-input w-full min-h-[50px] py-3' rows='1'></textarea>
								</div>
							</div>`;

content = content.replace(uiPattern, uiReplacement);

fs.writeFileSync(file, content);
console.log('Edit page updated!');
