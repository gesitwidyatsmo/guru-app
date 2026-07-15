const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials not found");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function capitalize(str) {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
}

const data = [
  // XI 1
  { kelas: 'XI 1', kelamin: 'Laki-laki', nama: ["Abdul Hamid Syaiful Barnawi", "Adil Rashad Zaki", "Ardiul Hafidz", "Aris Tama Putra", "Chessli Alkhazahri", "Daffa Dzakwan Irsyad", "Danil", "Dhigo Pratama", "Fahry Al Gizrie", "Firly Rizky Adha", "Ilham Juwanda", "Irsyadur Rifqi", "Jos Raharjo", "Ma'ruf Nurdiansyah", "M. Irfan Alghifary", "M.Riski Alfariz", "Magenta Aidil Rahman", "Muhammad Alfi Zadah", "Muhammad Fachry Yusuf", "Muhammad Ilham", "Muhammad Rafiansyah", "Nauval Hysaam Amrullah", "Ozi Ovandra", "Raditya Firmansyah", "Resno Fauzan Al Hafiz", "Risqi Andika Pratama", "Rudi Setiawan", "Wildan Rizky"] },
  // XI 2
  { kelas: 'XI 2', kelamin: 'Laki-laki', nama: ["Ahmadilah Rifanto", "Ahmat Ilham Romadhon", "Aldy Pramuditya", "Alfikri", "Arya Pandu Brilliant", "Bagas", "Budi Septria", "David Alamsyah", "Dika Setiawan", "Elvino Aqil Adzaky", "Fadhlan Naufal Hidayatullah", "Firhan Al Zikri", "Galih Latifatul Fadli", "Habib Qowwiya", "Hayyu Al Rozaqi", "Ilham Bagus Ramadani", "Labib Deskha Pratama", "M. Arif Alfarizi", "Muhamad Khoirul Tri Sugiarto", "Muhammad Eko Bima Saputra", "Muhammad Fatkhur Rizky", "Muhammad Inggil Maulana Ibrahim", "Muhammad Revand Alfajri", "Mumtaz Al Baqi", "Raditya Faturahman", "Royhan Yusuf At Thibbi", "Safwan Zaizuly", "Tegar Ananka Pratama", "Wisnu Lutfiansyah", "Yoga May Prasetyo"] },
  // XI 3
  { kelas: 'XI 3', kelamin: 'Perempuan', nama: ["AINA BISMIKA FATMA", "ALFYA CHELSHELIA", "ANASTASYA AULIA", "ANISSA KOIROTUS ZAHRA", "Anisyatul Nabila", "ASSYIFA RAHMATUL HUSNA", "Aufa Azalia", "AVELYA DIAN NINGTIAS", "Ayu Kanza Salamah", "DARA ANGGIA WAFIROH", "DEA ANANTA SIREGAR", "DEA RAHMA SAID", "Diah Asyifa Deviana", "DIKA ARUM UTAMI", "Dina Amelia Putri", "DIRA ANGGIA WAFIROH", "DWI ALSAPITRI", "ELSA LAILY SAPUTRI", "Elvina Ramadani", "FAUZIAH ZULFA RISKI", "FINA AYU LESTARI", "FITA SARI", "FITRI RAHMA SARI", "HAFIDZAH AULIA AZHARI", "HAFIZAH HUSNATULLAILA", "IMELDA OLIVIA", "IRA BORU RAHMAN", "ISTIQOMAH KAFFAH", "Liliana Sulistiyaningsih", "MALA VITA SARI", "Miftahatun Mafanza Mutiara", "Moza Putri Anjani", "Muhajarotul Khusnia", "MUSTIVATUL MAULIDAH", "MUTIARA", "NABILA AZIZAH", "NAYZILA DWI LESTARI"] },
  // XI 4
  { kelas: 'XI 4', kelamin: 'Perempuan', nama: ["NAZILA RAHMATIKA HABIB", "Nazwa May Nur Winarni", "NEVA SETIA NINGSIH", "NOVI NURAINI", "Nur Hidayah", "Nur Indah Safitri", "NUR KHANI FATUSSAADAH", "Pika Mutiara", "Qoonitah Simanjuntak", "Siva Afril Lanni", "ULFIATUL KHOIROH", "RAHMA ROMA DONA", "RAHMATIKA KHOIRUN NISA", "REFA PUTRIYANTI", "Resti Muthia Rahmawati", "REVANY RIHADATUL AISYI", "RIMA SEPTIANI", "RIVA ANZILA RAHMA", "RIZKA SALSABILA IRAWAN", "Rizkia Indana Zulfa", "SAFA NOVIA SARI", "Saniya Roudlotullatiifah", "SHINTA AULIA SHANWIRYA", "Silvi Zulia Asrofi", "SIVA MERYANA", "SOPI ARIANI", "SYLA HAFIDZAH RAMADHANI", "THASYA NURDIANINGSIH", "TRIA SARI RETNO WATI", "Winnie Alenskia Sirait", "Yasmin Safinatun Najwa", "ZAHRA ALYA FATHIYA", "ZARWA SUGIARTI", "Zaskia Aulia Putri", "ZILIA LAYLI NAFISA"] },
  // XI 5
  { kelas: 'XI 5', kelamin: 'Perempuan', nama: ["ALMEIRA RAHMA UTAMI", "Atikah Miftakhul Jannah", "AYU BUNGA LESTARI", "Ayu Salimah", "CANTIKA BERLIANDA PUTRI", "Cintya Maulidya", "Citra Agustia", "DWI APRIYANTI", "ELISA RISKI", "FARA NURIANA", "FATKHIYATUZ ZAHROH", "HANI UMI LATIPAH", "Kulsum Khotimah", "Kamila Insani Kaisan", "KANZA NURMADINATUL ARSYA", "KHUMAIRA NUR FADYAH", "Kia Febiansyah Nita", "MEIFA ZUMRATUL LATIFAH", "NAJWA TSAQOVA", "Naswa Puspa Ningrum", "NISA ALFIZAH", "NOVI YANI DONGORAN", "Nurrahma Rahmadhani", "ULFATUS SAIBA", "Ranti Amelia", "Rifa iyyah", "RISMA AYU RAMADHANI", "Sabrina Aita Safaroh", "SERLINA ANGGRIANI", "SITI ANISAH BILQIS SUGIONO", "Siti Nurhaliza", "SYARIFAH ANNISA RAMADANI", "UKHTIA RAHMADANI", "Versi Ellora Bakti", "WISMI DINIARTI", "ZASKIA IKA RAHMADHANI"] }
];

async function insertData() {
  const allSiswa = [];

  for (const group of data) {
    for (let i = 0; i < group.nama.length; i++) {
      const idStr = `${group.kelas.replace(' ', '')}-${i + 1}`;
      allSiswa.push({
        id: idStr, // Use a unique ID based on class and number
        nis: idStr, // "samakan saja dengan id nya" -> NIS is same as ID
        nama_lengkap: capitalize(group.nama[i]),
        kelas: group.kelas,
        jenis_kelamin: group.kelamin,
        status: 'Aktif'
      });
    }
  }

  console.log(`Inserting ${allSiswa.length} records...`);

  // Since classes might not exist, let's create them first just in case
  const classes = [...new Set(allSiswa.map(s => s.kelas))];
  for (const kelas of classes) {
    const { error } = await supabase.from('kelas').insert({ id: `KLS-${kelas.replace(' ', '')}`, nama_kelas: kelas }).select();
    if (error && error.code !== '23505') {
       console.log('Class insert error:', error);
    }
  }

  // Insert in batches of 50
  for (let i = 0; i < allSiswa.length; i += 50) {
    const batch = allSiswa.slice(i, i + 50);
    const { error } = await supabase.from('siswa').upsert(batch);
    if (error) {
      console.error('Error inserting batch:', error);
    } else {
      console.log(`Inserted batch ${i} to ${i + batch.length}`);
    }
  }

  console.log('Cleaning up obsolete records...');
  for (const group of data) {
    const validIds = group.nama.map((_, i) => `${group.kelas.replace(' ', '')}-${i + 1}`);
    const { data: existingSiswa, error: fetchError } = await supabase
      .from('siswa')
      .select('id')
      .eq('kelas', group.kelas);
    
    if (existingSiswa) {
      const idsToDelete = existingSiswa
        .map(s => s.id)
        .filter(id => !validIds.includes(id));
      
      if (idsToDelete.length > 0) {
        console.log(`Deleting ${idsToDelete.length} obsolete records for ${group.kelas}...`);
        await supabase.from('siswa').delete().in('id', idsToDelete);
      }
    }
  }

  console.log('Done!');
}

insertData();
