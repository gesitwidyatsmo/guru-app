const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials not found");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const correctData = [
  // XII 1
  { kelas: 'XII 1', nama: ["Agus Susanto", "Ahidit Wahyudi", "Alpin Sahputra", "Beny Setiawan", "Dedy Setiadi", "Fahri Abdul Hanif", "Farel Irgian Virerza", "Faris Zaky Ahmadtulloh", "Gigih Ali Sofyan", "Ikhsan Yusuf Hidayat", "Julian Alfino Ferdiansyah", "M. Shobirin Saputra", "Maulana Ikhsan", "Mohammad Raditya Pratama Irfan", "Muhamad Taufik Nurhidayat", "Muhamad Zikri Firmansyah", "Muhammad Alfarizi", "Muhammad Dani Alhakim", "Muhammad Dhani Saputra", "Naufal Ariba Yusro", "Rafiq Hariri", "Raka Aditya Pratama", "Revan Rizki Agustian", "Rhendy Ahmad Basuki", "Riddho Syubkhi", "Surya Pratama Fahrelliansyah", "Zulfahmi Candra Ginatan"] },
  // XII 2
  { kelas: 'XII 2', nama: ["Ahmad Izudin Ubaidillah", "Alvin Pratama Imanudin", "Azhar Faris Arasyid", "Dika Pratama", "Dimas Pasya Saputra", "Fadhil Azmy Pratama", "Fatku Rohman", "Fawwaz Rizaka", "Fergie Ikhsan", "Hakimul Adli", "Henkky Irawan Siregar", "Jonal Dika", "Khoirul Anwar", "M. Imam Musyaffa", "Mahsun Huda", "Muhamad Dwi Praditya Herianto", "Muhamad Maulana", "Muhamad Yusuf Nurasyid", "Muhammad Alfan As'Ari", "Muhammad Ali Romadhon", "Muhammad Burhanuddin", "Muhammad Dzaka Prawira", "Muhammad Khoirun Ni'Amy", "Nur Abdillah Mu'Iz", "Pratama Aidil Fitrah", "Radit Devfahry", "Respati Bayuaji Kamajaya", "Tatong Ihsantri"] },
  // XII 3
  { kelas: 'XII 3', nama: ["Anisa Liswianti", "Aurel", "Bela Sapitri", "Bella Ayu Lestari", "Deby Etika Maharani", "Eva Azkiya Nur Rohim", "Irna Puji Astuti", "Jenita Nur Sabila", "Lutfiana Nursabita", "Melany", "Nurul Choirul Ningsih", "Rahma Aulia", "Rara Zaskia Junianti", "Reni Wahyu Ulandari", "Riska Hasanah", "Risma Adelia Putri", "Rista Novelya", "Risty Nadiyanti", "Salma Nurul Fathonah", "Sapwa Syahrani", "Sheril Rahmawati", "Sri Ikke Rahmawati Sholeha", "Suci Rahmadani", "Uyun Khomariyah", "Vanecia Zahratun Niswa", "Wirda Tusifa", "Yelsa Afrianti", "Yelsa Yunia Putri"] },
  // XII 4
  { kelas: 'XII 4', nama: ["Alisah Nursakinah", "Amelia Dwi Kusumawati", "Amelya Indriani", "Anisa Nurjanah", "Annifa'u Sholikhah", "Dinda Alfiah", "Elvia Hasanah", "Gilsa Rahmadani", "Hana Amalia", "Hamidatul Husna", "Intan Nur Febrianti", "Jihan Pahira", "Karisma Cantika", "Luna Losari", "Madina Suci Rahayu Al,Munawarah", "Mazidatul Magfiroh", "Milla Nafisah", "Muhtia Dewi Br Sinaga", "Nadia Dwi Rahayu", "Nadin Syabhani", "Nayla Putri Ramadhani", "Nisatul Karomah", "Nur Fadilatun Afrillia", "Novi Risma Olivia", "Piranti Kinasih", "Quilla Gadizavirgin", "Rissa Iffatun Nafsi", "Ulfatul Khasanah", "Wilda", "Yuni Salamah"] },
  // XII 5
  { kelas: 'XII 5', nama: ["Anisa Avrilian Shenia", "Chika Kasih Ardana", "Dea Putri Rahmawati", "Dety Novita Liana", "Efriza Wati", "Erika Zola Nuraini", "Firni Tara Santika", "Heni Miftahul Jannah", "Ina Yatus Syifa", "Intan Nailatul Izzah Ufairoh", "Intan Nur Febrianti", "Lailatul Munawaroh", "Lusiana Maysaroh", "Melany", "Miftahus Salamah", "Mutia Az Zahra Mauliana R", "Novira Sulistia", "Nuria Aulia Gadis", "Parida Anum", "Putri Natalia", "Ressa Clarawati", "Saufa Ajry", "Seftia Ramadhani", "Syafaatul Uzma Abdillah", "Syafika Khoerunnisa", "Syifa Salsabila Mahfud", "Tri Nuraini", "Zaneta Maya Suryani", "Zian Sephia Cinta Ramadani"] }
];

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fixData() {
  const { data: dbSiswa, error } = await supabase.from('siswa').select('*').like('kelas', 'XII%');
  if (error) throw error;

  const updates = [];
  const deletes = [];
  const inserts = [];

  const correctList = [];
  for (const group of correctData) {
    for (const name of group.nama) {
      correctList.push({ nama_lengkap: name, kelas: group.kelas, kelamin: 'Unknown', normalized: normalize(name) });
    }
  }

  const dbPool = [...dbSiswa];

  for (const corr of correctList) {
    const idx = dbPool.findIndex(db => normalize(db.nama_lengkap) === corr.normalized);
    if (idx !== -1) {
      const dbMatch = dbPool.splice(idx, 1)[0];
      if (dbMatch.nama_lengkap !== corr.nama_lengkap || dbMatch.kelas !== corr.kelas) {
        updates.push({ ...dbMatch, nama_lengkap: corr.nama_lengkap, kelas: corr.kelas });
      }
      corr.matched = true;
    }
  }

  for (const corr of correctList.filter(c => !c.matched)) {
    const idx = dbPool.findIndex(db => normalize(db.nama_lengkap).includes(corr.normalized.substring(0, 10)) || corr.normalized.includes(normalize(db.nama_lengkap).substring(0, 10)));
    if (idx !== -1) {
      const dbMatch = dbPool.splice(idx, 1)[0];
      updates.push({ ...dbMatch, nama_lengkap: corr.nama_lengkap, kelas: corr.kelas });
      corr.matched = true;
    } else {
      inserts.push({
        id: `XII-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        nis: `NIS-${Date.now()}`,
        nama_lengkap: corr.nama_lengkap,
        kelas: corr.kelas,
        jenis_kelamin: corr.kelas.includes('1') || corr.kelas.includes('2') ? 'Laki-laki' : 'Perempuan',
        status: 'Aktif'
      });
    }
  }

  for (const db of dbPool) {
    deletes.push(db.id);
  }

  console.log(`To Update: ${updates.length}`);
  console.log(`To Insert: ${inserts.length}`);
  console.log(`To Delete: ${deletes.length}`, deletes.map(d => dbSiswa.find(s=>s.id === d).nama_lengkap));

  if (updates.length > 0) {
    const { error } = await supabase.from('siswa').upsert(updates);
    if (error) console.error("Error updates", error);
  }
  if (inserts.length > 0) {
    const { error } = await supabase.from('siswa').insert(inserts);
    if (error) console.error("Error inserts", error);
  }
  if (deletes.length > 0) {
    const { error } = await supabase.from('siswa').delete().in('id', deletes);
    if (error) console.error("Error deletes", error);
  }
}

fixData().then(() => console.log('Done!'));
