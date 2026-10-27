const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const parseJamPelajaran = (jamVal) => {
	if (!jamVal && jamVal !== 0) return [];
	const raw = String(jamVal).trim();
	if (!raw) return [];
	const cleaned = raw.replace(/^(jam|ke)\s*[-:]?\s*/i, '');
	const segments = cleaned.split(/[,&]/);
	const resultSet = new Set();
	for (const segment of segments) {
		const part = segment.trim();
		if (!part) continue;
		const rangeMatch = part.match(/^(\d+)\s*(?:[-–—]|s\/?d\.?|sampai)\s*(\d+)$/i);
		if (rangeMatch) {
			const start = parseInt(rangeMatch[1], 10);
			const end = parseInt(rangeMatch[2], 10);
			if (!isNaN(start) && !isNaN(end)) {
				const min = Math.min(start, end);
				const max = Math.max(start, end);
				if (max - min <= 15) {
					for (let i = min; i <= max; i++) resultSet.add(i);
					continue;
				}
			}
		}
		const numbers = part.match(/\d+/g);
		if (numbers) {
			numbers.forEach((n) => {
				const val = parseInt(n, 10);
				if (!isNaN(val)) resultSet.add(val);
			});
		}
	}
	return Array.from(resultSet).sort((a, b) => a - b);
};

const checkJamOverlap = (jamA, jamB) => {
	const aParsed = parseJamPelajaran(jamA);
	const bParsed = parseJamPelajaran(jamB);
	if (aParsed.length === 0 || bParsed.length === 0) {
		const sA = String(jamA || '').trim().toLowerCase();
		const sB = String(jamB || '').trim().toLowerCase();
		const exact = sA === sB && sA !== '';
		return { isOverlap: exact, isExact: exact, conflicts: [] };
	}
	const isExact = aParsed.length === bParsed.length && aParsed.every((val, index) => val === bParsed[index]);
	const conflicts = aParsed.filter((j) => bParsed.includes(j));
	return { isOverlap: conflicts.length > 0, isExact, conflicts };
};

async function run() {
  const { data: allJurnal, error } = await supabase
    .from('jurnal')
    .select('id, tanggal, kelas, mapel, jam_ke, pertemuan_ke, materi, guru_id, created_at, users!jurnal_guru_id_fkey(nama_lengkap, username)')
    .order('tanggal', { ascending: false })
    .order('kelas', { ascending: true })
    .order('jam_ke', { ascending: true });

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const groups = new Map();
  for (const j of allJurnal) {
    const tgl = String(j.tanggal || '').slice(0, 10).trim();
    const kls = String(j.kelas || '').trim();
    const key = `${tgl} | ${kls}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(j);
  }

  const conflictClusters = [];

  for (const [key, list] of groups.entries()) {
    if (list.length < 2) continue;

    const involvedInConflict = new Set();
    const pairConflicts = [];

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const res = checkJamOverlap(a.jam_ke, b.jam_ke);
        if (res.isOverlap) {
          involvedInConflict.add(a.id);
          involvedInConflict.add(b.id);
          pairConflicts.push({ a, b, overlap: res });
        }
      }
    }

    if (pairConflicts.length > 0) {
      const [tgl, kls] = key.split(' | ');
      const entries = list.filter(item => involvedInConflict.has(item.id));
      conflictClusters.push({
        tanggal: tgl,
        kelas: kls,
        pairs: pairConflicts,
        entries: entries
      });
    }
  }

  console.log(`TOTAL_CLUSTERS=${conflictClusters.length}`);
  conflictClusters.forEach((c, idx) => {
    console.log(`\n--- [KASUS ${idx + 1}] Tanggal: ${c.tanggal} | Kelas: ${c.kelas} ---`);
    console.log(`Daftar Baris Jurnal yang Terlibat (${c.entries.length} entri):`);
    c.entries.forEach(e => {
      const guru = e.users?.nama_lengkap || e.guru_id;
      console.log(`  * ID: "${e.id}" | Jam: "${e.jam_ke}" | Ptm: ${e.pertemuan_ke} | Mapel: "${e.mapel}" | Guru: "${guru}" | Materi: "${e.materi}" | Created: ${e.created_at}`);
    });
    console.log('Rincian Bentrok:');
    c.pairs.forEach(p => {
      const type = p.overlap.isExact ? 'DUPLIKAT PERSIS' : 'TUMPANG TINDIH / IRISAN';
      const sameTeacher = p.a.guru_id === p.b.guru_id ? 'Guru Sama' : 'BEDA GURU';
      console.log(`  -> [${type}] [${sameTeacher}] ID ${p.a.id} (Jam ${p.a.jam_ke}) VS ID ${p.b.id} (Jam ${p.b.jam_ke}) | Bentrok di Jam: ${p.overlap.conflicts.join(', ')}`);
    });
  });
}

run();
