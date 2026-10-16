# Desain Sistem Role — Guru App

> Dokumen ini menjelaskan seluruh role yang ada dan direncanakan dalam sistem Guru App, termasuk hak akses per fitur, relasi database, dan panduan implementasi teknis.

---

## Daftar Isi

1. [Role yang Sudah Ada](#1-role-yang-sudah-ada)
2. [Role Baru — Tahap 1](#2-role-baru--tahap-1-prioritas-utama)
3. [Role Baru — Tahap 2](#3-role-baru--tahap-2-direncanakan)
4. [Hierarki Akses](#4-hierarki-akses-lengkap)
5. [Perubahan Database](#5-perubahan-database)
6. [Perubahan Middleware & API](#6-perubahan-middleware--api)
7. [Perubahan UI](#7-perubahan-ui)
8. [Prioritas Implementasi](#8-prioritas-implementasi)

---

## 1. Role yang Sudah Ada & Aktif

### 🔴 Admin
Akses penuh ke seluruh sistem. Mengelola pengguna, penugasan KBM, master data institusi, kalender akademik, dan konfigurasi sistem.

| Halaman | Akses | Keterangan |
|---|---|---|
| `/admin` | ✅ Full | Dashboard sentral administrator |
| `/admin/pengguna` | ✅ CRUD pengguna | Kelola akun Admin, Guru, Kepsek, & Bendahara |
| `/admin/penugasan` | ✅ Kelola penugasan KBM | Distribusi rombel & mapel dewan guru |
| `/admin/tahun-ajar` | ✅ Kelola tahun ajaran | Semester aktif & kalender akademik |
| `/admin/kelas`, `/admin/mapel` | ✅ Master Data | Kelola rombel belajar & kurikulum |
| `/admin/promosi-kelas` | ✅ Promosi siswa | Kenaikan kelas & mutasi massal |
| `/admin/sekolah` | ✅ Profil Sekolah | Data kelembagaan, NPSN, & Kepala Sekolah |
| `/admin/pengumuman` | ✅ CRUD pengumuman | Siaran informasi sekolah |
| `/admin/backup` | ✅ Backup & restore | Pemeliharaan data sistem |

---

### 🔵 Guru
Akses ke fitur kegiatan belajar mengajar (KBM) operasional sesuai penugasan kelas & mata pelajaran yang diampu.

| Halaman | Akses | Keterangan |
|---|---|---|
| `/` | ✅ Beranda Guru | Jadwal hari ini, ringkasan KBM, statistik tugas |
| `/absensi` | ✅ Catat absensi | Kehadiran siswa di kelas/sesi yang diajar |
| `/penilaian` | ✅ Input nilai | Tugas, ulangan harian, formatif/sumatif |
| `/jurnal` | ✅ Jurnal Mengajar | Bukti fisik jam mengajar (JTM), materi, kendala |
| `/tugas` & `/tugas-online` | ✅ Kelola tugas | Tugas terstruktur & pengumpulan online |
| `/soal` | ✅ Bank soal | Manajemen butir soal ujian/kuis |
| `/jadwal` | ✅ Jadwal mengajar | Kalender jadwal KBM mingguan |
| `/laporan` | ✅ Rekap KBM | Cetak absensi, rekap nilai & jurnal yang diampu |
| `/siswa` | 👁️ Lihat data siswa | Profil siswa di kelas yang diajar |
| `/poin` | ✅ Pembinaan karakter | Poin prestasi & pelanggaran siswa |
| `/catatan` | ✅ Catatan guru | Catatan harian & agenda pribadi |
| `/admin`, `/kepsek`, `/bendahara` | ❌ Ditolak | Khusus role manajemen |

---

### 🎓 Kepala Sekolah (Status: ✅ Selesai Diimplementasikan)
Portal mandiri monitoring eksekutif (**Executive Read-Only**) dengan layout terpisah yang modern dan responsif. Memiliki hak supervisi penuh tanpa mengubah (*mutate*) data operasional guru.

* **Arsitektur:** Halaman dan layout independen di `/kepsek/*` dengan *zero-flicker server cookie loading*. Begitu login, otomatis dialihkan ke `/kepsek`.
* **Keamanan:** Proteksi ketat read-only di level API (`x-user-role` 403 saat POST/PUT/DELETE pada modul akademik).

| Halaman | Akses | Keterangan |
|---|---|---|
| `/kepsek` | 👁️ Dashboard Eksekutif | Statistik KBM, rasio jurnal, rekap guru & siswa |
| `/kepsek/jurnal` | 👁️ Supervisi Jurnal Guru | Filter harian, pantau materi & catatan kendala |
| `/kepsek/penilaian` | 👁️ Rekap Capaian Nilai | Distribusi nilai siswa, KKM, & status remedial |
| `/kepsek/absensi` | 👁️ Presensi Mapel | Rekapitulasi kehadiran siswa per rombel |
| `/kepsek/poin` | 👁️ Poin Karakter | Monitoring prestasi & pelanggaran siswa |
| `/kepsek/kelas` | 👁️ Daftar Rombel | Profil kelas, kapasitas siswa, & wali kelas |
| `/kepsek/laporan` | 👁️ Laporan Akademik | Unduh & cetak rekapitulasi KBM komprehensif |
| `/kepsek/pengguna` | 👁️ Daftar Pengguna | Pantau dewan guru & staf (tanpa edit/tambah) |
| `/kepsek/penugasan` | 👁️ Penugasan KBM | Pantau persebaran jam mengajar guru |
| `/kepsek/tahun-ajar` | 👁️ Kalender Akademik | Status semester aktif |
| Export Data (CSV/Print) | ✅ Unduh Laporan | Ekspor seluruh tabel supervisi |

---

### 💼 Bendahara / Keuangan (Status: ✅ Selesai / Live)
Portal khusus pengelolaan keuangan, presensi mengajar guru berbasis jam riil (*proof of teaching*), kalkulasi bisaroh/honorarium guru berjenjang, tunjangan & potongan kustom dinamis, serta penerbitan slip gaji digital.

* **Latar Belakang:** Bisaroh guru dihitung berbasis akumulasi **Jam Tatap Muka (JTM)** riil dari tabel `jurnal` (misal jam ke `"1-2"` = 2 JP).
* **Arsitektur:** Memiliki portal mandiri di `/bendahara/*` dengan navigasi khusus urusan finansial.
* **Fitur Unggulan Konfigurasi Tarif & Tunjangan:**
  - **Tingkatan Guru & Tarif JP Dinamis:** Kategori berjenjang (e.g. Guru Senior, Madya, Junior, GTY, GTT) dengan tarif JP fleksibel + assignment per guru.
  - **Tunjangan Pokok Sistem (Full CRUD):** Tunjangan dasar institusi (Wali Kelas, Uang Kehadiran Harian, Gaji Pokok Yayasan, Tunjangan Pengabdian) kini dapat ditambah, diedit nominal/kriterianya, dinonaktifkan, atau dihapus secara fleksibel.
  - **Tunjangan Tambahan Fleksibel (Full CRUD):** Penambahan tunjangan variabel (e.g. Uang Transport Bulanan, Tunjangan Fungsional, Ekstrakurikuler) dengan tipe hitung: per bulan, per hari hadir, atau per JP, serta cakupan penerima (semua guru atau guru tertentu).
  - **Potongan Tetap Dinamis:** Pengelolaan iuran/potongan (e.g. Infaq bulanan, Koperasi, Dana Sosial).
  - **Kalkulasi & Slip Gaji Terperinci:** Rincian transparan breakdown honor JP, tunjangan pokok, tunjangan tambahan, bonus, dan potongan di modal slip gaji yang siap cetak.

| Halaman | Akses | Keterangan |
|---|---|---|
| `/bendahara` | ✅ Dashboard Keuangan | Ringkasan estimasi bisaroh, total JTM guru, distribusi tingkatan, & cut-off |
| `/bendahara/jtm` | ✅ Rekap JTM & Kehadiran | Agregasi jam mengajar riil guru dari jurnal per cut-off bulanan + badge tingkatan |
| `/bendahara/bisaroh` | ✅ Kalkulasi Bisaroh | Hitung otomatis honor JP berjenjang + tunjangan pokok + tunjangan tambahan - potongan |
| `/bendahara/tarif` | ✅ Konfigurasi Tarif & Tunjangan | 4 Tab: Tingkatan Guru & Assignment, Tunjangan Dinamis, Potongan Dinamis, Cut-Off |
| `/bendahara/guru` | ✅ Data Dewan Guru | Daftar resmi guru, username, tingkatan guru, tarif JP, dan status wali kelas |
| `/bendahara/jurnal` | 👁️ Audit Jurnal KBM | Pemeriksaan bukti fisik KBM & kendala sebelum pencairan bisaroh |
| Slip Gaji & SPJ | ✅ Cetak & Ekspor | Cetak slip digital per guru (rinci per komponen) & unduh rekapitulasi penggajian |

---

## 2. Role Baru — Tahap 1 (Pengembangan Lanjutan)

---

### 👪 Wali Murid

> Orang tua atau wali siswa. Hanya bisa melihat data anak mereka sendiri melalui portal khusus.

**Prinsip: Satu wali murid = hanya data anaknya.**

| Halaman | Akses |
|---|---|
| `/wali-murid` (dashboard) | ✅ Dashboard ringkasan anak |
| Absensi anak | 👁️ Rekap kehadiran anaknya saja |
| Nilai anak | 👁️ Laporan nilai anaknya |
| Poin/perilaku anak | 👁️ Histori poin anaknya |
| Jadwal kelas anak | 👁️ Jadwal kelas |
| Tugas anak | 👁️ Daftar tugas yang diberikan ke anak |
| Pengumuman | 👁️ Pengumuman umum sekolah |
| Edit data apapun | ❌ Tidak ada akses edit |
| Fitur guru | ❌ Tidak ada akses |

**Relasi database:**
```sql
-- Tabel baru: wali_murid
CREATE TABLE wali_murid (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, id_siswa) -- hindari duplikat relasi
  -- Catatan: satu wali murid bisa punya lebih dari satu anak (multiple rows)
);
```

**Catatan teknis:**
- Butuh route baru: `/wali-murid` dan `/wali-murid/[id_siswa]`
- Saat login, sistem perlu fetch daftar anak dari `wali_murid` lalu arahkan ke dashboard anak
- Pertimbangkan **notifikasi push** (PWA sudah terpasang) untuk alert absensi alfa / nilai rendah

---

### 🔒 Keamanan

> Petugas satpam/keamanan sekolah. Fokus pada monitoring kedatangan dan kepulangan siswa di gerbang sekolah.

| Halaman | Akses |
|---|---|
| `/keamanan` (dashboard) | ✅ Dashboard absensi gerbang |
| Catat absensi masuk/pulang | ✅ Input kehadiran siswa di gerbang |
| Lihat daftar siswa hari ini | ✅ Siapa sudah/belum hadir |
| Tandai siswa terlambat | ✅ Flag keterlambatan |
| Rekap absensi harian | ✅ Statistik kehadiran hari ini |
| Info dasar siswa (nama, kelas, foto) | 👁️ Untuk identifikasi |
| Fitur akademik (nilai, mapel, dll) | ❌ Tidak ada akses |
| `/admin` | ❌ Tidak ada akses |
| Edit data siswa | ❌ Tidak ada akses |

**Catatan teknis:**
- Butuh route baru: `/keamanan`
- UI dioptimalkan untuk **layar sentuh** (tablet di pos satpam)
- Simpan ke tabel `absensi` dengan kolom tambahan `jenis: 'gerbang'` atau tabel terpisah `absensi_gerbang`
- Pertimbangkan fitur **scan QR** memanfaatkan kamera tablet

---

## 3. Role Baru — Tahap 2 (Direncanakan)

### 🧠 Guru BK (Bimbingan Konseling)

> Konselor sekolah. Fokus memantau perilaku, kesejahteraan, dan kehadiran **seluruh siswa** (bukan hanya satu kelas).

| Halaman | Akses |
|---|---|
| `/poin` | ✅ Lihat & beri poin perilaku **semua siswa** |
| `/absensi` | 👁️ Lihat rekap absensi semua siswa |
| `/siswa` | 👁️ Lihat profil & histori semua siswa |
| Catatan konseling | ✅ Buat & kelola catatan konseling per siswa |
| `/laporan` | 👁️ Laporan perilaku & kehadiran |
| `/penilaian`, `/soal`, `/jurnal` | ❌ Tidak ada akses (bukan guru mapel) |
| `/admin` | ❌ Tidak ada akses |

**Catatan:** Bisa dipertimbangkan penambahan tabel `catatan_bk` untuk mencatat sesi konseling.

---

### 📋 Tata Usaha (TU)

> Staf administrasi sekolah. Mengelola data & dokumen, bukan akademik.

| Halaman | Akses |
|---|---|
| `/siswa` | ✅ CRUD data siswa (tambah, edit, arsip, mutasi) |
| `/berkas` | ✅ Kelola dokumen & berkas sekolah |
| `/absensi` | 👁️ Lihat rekap (untuk keperluan surat keterangan) |
| `/admin/promosi-kelas` | ✅ Promosi & mutasi siswa |
| `/laporan` | 👁️ Laporan administratif |
| `/admin/pengguna` | ❌ Tidak bisa kelola akun pengguna |
| `/penilaian`, `/soal`, `/jurnal` | ❌ Tidak ada akses |

---

### 🧑‍🎓 Siswa *(Student Portal)*

> Siswa dapat login untuk melihat data akademik dirinya sendiri.

| Halaman | Akses |
|---|---|
| `/siswa-portal` (dashboard) | ✅ Dashboard ringkasan diri |
| Lihat nilai diri sendiri | 👁️ Nilai per mapel |
| Lihat absensi diri sendiri | 👁️ Rekap kehadiran |
| Lihat tugas | 👁️ Tugas yang diberikan |
| Lihat jadwal | 👁️ Jadwal kelas |
| Lihat poin perilaku | 👁️ Histori poin diri sendiri |
| Edit data apapun | ❌ Tidak ada akses |

**Relasi database:**
```sql
-- Tabel baru: siswa_auth
CREATE TABLE siswa_auth (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa) ON DELETE CASCADE,
  UNIQUE(id_siswa) -- satu siswa hanya punya satu akun
);
```

---

### 🏛️ Wakasek (Wakil Kepala Sekolah)

> Level akses **di antara** Guru dan Kepala Sekolah, tergantung bidangnya.

| Wakasek | Akses Utama |
|---|---|
| **Kurikulum** | Jadwal, mapel, penugasan KBM, laporan nilai |
| **Kesiswaan** | Siswa, poin/perilaku, absensi, rekap kesiswaan |
| **Sarana & Prasarana** | Berkas, data inventaris |
| **Humas** | Pengumuman, laporan untuk pihak eksternal |

> **Rekomendasi:** Implementasikan sebagai **satu role "Wakasek"** dengan akses gabungan, bukan 4 role terpisah — kecuali ada kebutuhan spesifik pemisahan.

---

## 4. Hierarki Akses Lengkap

```
Kepala Sekolah ──── Supervisi Eksekutif Seluruh KBM & Institusi (/kepsek)
      │
      ├─── Bendahara ──────── Keuangan, Bisaroh Guru, Tarif JP, & Rekap JTM (/bendahara)
      ├─── Wakasek Kurikulum ── Jadwal, mapel, nilai
      └─── Wakasek Kesiswaan ── Siswa, poin, absensi

Admin ──────────────── Full access + kelola sistem & pengguna (/admin)
      │
      └─── Tata Usaha ──── Data siswa, berkas

Guru ────────────────── Operasional mengajar KBM (/)
      ├─── Wali Kelas ── + monitoring menyeluruh kelas yang dipegang
      └─── Guru BK ───── + monitoring perilaku semua siswa

Keamanan ───────────── Absensi gerbang saja (/keamanan)

Wali Murid ─────────── Data anak sendiri saja (/wali-murid)
Siswa ──────────────── Data diri sendiri saja (/siswa-portal)
```

---

## 5. Perubahan Database

### 5.1. Nilai Enum / Check Constraint Role di `public.users`

Kolom `role` di tabel `users` divalidasi dengan constraint PostgreSQL:

```sql
-- Status Aktif Saat Ini (Admin, Guru, Kepala Sekolah, Bendahara):
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('Admin', 'Guru', 'Kepala Sekolah', 'Bendahara'));

-- Role Baru Tahap Berikutnya:
-- 'Wali Kelas' | 'Keamanan' | 'Guru BK' | 'Tata Usaha' | 'Siswa' | 'Wali Murid' | 'Wakasek'
```

### 5.2. Tabel & Konfigurasi Baru

```sql
-- 1. Pengaturan Bisaroh di app_settings (JSONB Key-Value)
-- Key: 'bisaroh_settings'
-- Value: {
--   "tarif_per_jp": 35000,
--   "tunjangan_wali_kelas": 150000,
--   "tunjangan_kehadiran_per_hari": 15000,
--   "cut_off_tanggal": 25
-- }

-- 2. Relasi Wali Kelas ke Kelas
CREATE TABLE IF NOT EXISTS wali_kelas (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_kelas      TEXT NOT NULL REFERENCES kelas(id_kelas) ON DELETE CASCADE,
  tahun_ajar_id TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tahun_ajar_id)
);

-- 3. Relasi Wali Murid ke Siswa
CREATE TABLE IF NOT EXISTS wali_murid (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, id_siswa)
);

-- 4. Relasi Siswa (akun) ke Data Siswa
CREATE TABLE IF NOT EXISTS siswa_auth (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_siswa)
);

-- 5. Catatan konseling Guru BK (opsional)
CREATE TABLE IF NOT EXISTS catatan_bk (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user),
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa),
  isi        TEXT NOT NULL,
  tanggal    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Perubahan Middleware & API

### 6.1. Konstanta Role (`src/lib/roles.js` & `proxy.js`)

```js
export const ROLES = {
  ADMIN:          'Admin',
  GURU:           'Guru',
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  BENDAHARA:      'Bendahara',
  WALI_KELAS:     'Wali Kelas',
  WALI_MURID:     'Wali Murid',
  KEAMANAN:       'Keamanan',
  GURU_BK:        'Guru BK',
  TATA_USAHA:     'Tata Usaha',
  SISWA:          'Siswa',
  WAKASEK:        'Wakasek',
};

// Pengelompokan hak akses
export const MANAGEMENT_ROLES = [ROLES.ADMIN, ROLES.KEPALA_SEKOLAH, ROLES.BENDAHARA];
export const READ_ALL_ROLES   = [ROLES.ADMIN, ROLES.KEPALA_SEKOLAH];
export const GURU_ROLES       = [ROLES.ADMIN, ROLES.GURU, ROLES.WALI_KELAS];
```

### 6.2. Middleware Routing (`src/proxy.js`)

Peta tujuan utama saat login / root redirect:

```js
const ROLE_HOME = {
  'Admin':          '/admin',
  'Kepala Sekolah': '/kepsek',
  'Bendahara':      '/bendahara',
  'Guru':           '/',
  'Wali Kelas':     '/',
  'Wali Murid':     '/wali-murid',
  'Keamanan':       '/keamanan',
  'Guru BK':        '/poin',
  'Tata Usaha':     '/siswa',
  'Siswa':          '/siswa-portal',
};

// Route Protection di proxy.js:
// - /admin/*      -> Admin, Kepala Sekolah (monitoring)
// - /kepsek/*     -> Kepala Sekolah, Admin
// - /bendahara/*  -> Bendahara, Admin
// - /             -> Guru KBM & peran pengajar
```

### 6.3. Pola Pengecekan di API Route

```js
// Contoh proteksi endpoint Bisaroh & Keuangan:
export async function GET(req) {
  const role = req.headers.get('x-user-role');
  const allowed = ['Admin', 'Bendahara', 'Kepala Sekolah'];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Akses Ditolak: Hanya bagian keuangan dan pimpinan.' }, { status: 403 });
  }
}

export async function PUT(req) {
  const role = req.headers.get('x-user-role');
  if (role !== 'Admin' && role !== 'Bendahara') {
    return NextResponse.json({ error: 'Akses Ditolak: Perubahan tarif hanya untuk Bendahara/Admin.' }, { status: 403 });
  }
}
```

---

## 7. Perubahan UI

### 7.1. Dropdown Role di `/admin/pengguna`

```jsx
const ROLE_OPTIONS = [
  { value: 'Guru',           label: 'Guru' },
  { value: 'Kepala Sekolah', label: 'Kepala Sekolah' },
  { value: 'Bendahara',      label: 'Bendahara / Keuangan' },
  { value: 'Admin',          label: 'Admin' },
  // Tahap berikutnya:
  // { value: 'Wali Kelas',  label: 'Wali Kelas' },
  // { value: 'Wali Murid',  label: 'Wali Murid' },
  // { value: 'Keamanan',    label: 'Keamanan' },
];
```

### 7.2. Halaman Portal Khusus Per Role

| Route | Untuk Role | Deskripsi |
|---|---|---|
| `/admin/*` | Admin | Pusat pengelolaan akun, KBM, dan kalender |
| `/kepsek/*` | Kepala Sekolah | Portal monitoring eksekutif supervisi KBM |
| `/bendahara/*` | Bendahara | Portal keuangan, rekap JTM, tarif & bisaroh |
| `/wali-murid` | Wali Murid | Portal orang tua — ringkasan anak |
| `/keamanan` | Keamanan | Dashboard absensi gerbang |
| `/siswa-portal` | Siswa | Portal siswa — data akademik diri sendiri |

### 7.3. Warna Badge Role (Neobrutalism Consistency)

```jsx
const ROLE_COLORS = {
  'Admin':          'bg-rose-200 text-rose-950 border-rose-400',
  'Kepala Sekolah': 'bg-indigo-200 text-indigo-950 border-indigo-400',
  'Bendahara':      'bg-emerald-200 text-emerald-950 border-emerald-400',
  'Guru':           'bg-amber-200 text-amber-950 border-amber-400',
  'Wali Kelas':     'bg-teal-200 text-teal-950 border-teal-400',
  'Wali Murid':     'bg-orange-200 text-orange-950 border-orange-400',
  'Keamanan':       'bg-slate-200 text-slate-950 border-slate-400',
  'Guru BK':        'bg-cyan-200 text-cyan-950 border-cyan-400',
  'Tata Usaha':     'bg-purple-200 text-purple-950 border-purple-400',
  'Siswa':          'bg-pink-200 text-pink-950 border-pink-400',
};
```

---

## 8. Prioritas Implementasi

| Urutan | Role | Status | Kompleksitas | Keterangan & Pencapaian |
|---|---|---|---|---|
| 1 | **Kepala Sekolah** | ✅ **Selesai (Live)** | 🟢 Rendah-Sedang | Portal `/kepsek/*` mandiri (10 modul supervisi, zero-flicker, Neobrutalism UI, read-only API). |
| 2 | **Bendahara** | ✅ **Selesai (Live)** | 🟡 Sedang | Portal `/bendahara/*`, rekap JTM real-time dari jurnal, tingkatan guru dinamis (Senior/Junior), tunjangan/potongan kustom, kalkulasi bisaroh, & slip gaji digital. |
| 3 | **Wali Kelas** | ⏳ Tahap Berikutnya | 🟡 Sedang | Butuh tabel `wali_kelas`, filter data berdasarkan kelas yang dipegang. |
| 4 | **Keamanan** | 📋 Terencana | 🟡 Sedang | Butuh halaman `/keamanan` baru, logika absensi gerbang. |
| 5 | **Guru BK** | 📋 Terencana | 🟡 Sedang | Akses data poin & absensi semua siswa, catatan konseling. |
| 6 | **Tata Usaha** | 📋 Terencana | 🟡 Sedang | Akses CRUD siswa & berkas, koordinasi surat menyurat. |
| 7 | **Wali Murid** | 📋 Terencana | 🔴 Tinggi | Butuh tabel `wali_murid`, halaman portal `/wali-murid`, filter ketat per anak. |
| 8 | **Siswa** | 📋 Terencana | 🔴 Tinggi | Butuh tabel `siswa_auth`, halaman portal `/siswa-portal`. |
| 9 | **Wakasek** | 📋 Terencana | 🟡 Sedang | Definisi akses integrasi kurikulum & kesiswaan. |

---

*Dokumen ini diperbarui terakhir: Oktober 2026*  
*Referensi implementasi: `src/proxy.js`, `src/app/kepsek/*`, dan `src/app/bendahara/*`*

