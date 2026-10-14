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

## 1. Role yang Sudah Ada

### 🔴 Admin
Akses penuh ke seluruh sistem. Satu-satunya role yang bisa mengelola pengguna lain dan konfigurasi sistem.

| Halaman | Akses |
|---|---|
| `/admin` | ✅ Full |
| `/admin/pengguna` | ✅ CRUD pengguna |
| `/admin/penugasan` | ✅ Kelola penugasan KBM |
| `/admin/tahun-ajar` | ✅ Kelola tahun ajaran |
| `/admin/promosi-kelas` | ✅ Promosi siswa |
| `/admin/pengumuman` | ✅ CRUD pengumuman |
| `/admin/backup` | ✅ Backup & restore data |
| Semua halaman lain | ✅ Full |

---

### 🔵 Guru
Akses ke fitur mengajar sesuai penugasan KBM yang diberikan oleh Admin.

| Halaman | Akses |
|---|---|
| `/absensi` | ✅ Catat absensi kelas yang diajar |
| `/penilaian` | ✅ Input nilai siswa |
| `/jurnal` | ✅ Catat jurnal mengajar |
| `/tugas` | ✅ Buat & kelola tugas |
| `/soal` | ✅ Buat bank soal |
| `/jadwal` | ✅ Lihat jadwal mengajar |
| `/laporan` | ✅ Rekap nilai, absensi, & jurnal kelas yang diajar |
| `/siswa` | 👁️ Lihat data siswa |
| `/poin` | ✅ Beri poin ke siswa |
| `/catatan` | ✅ Catatan pribadi guru |
| `/admin` | ❌ Tidak ada akses |

---

## 2. Role Baru — Tahap 1 (Prioritas Utama)

### 🏫 Wali Kelas

> Guru yang ditugaskan sebagai penanggung jawab satu rombongan belajar (kelas) tertentu. Memiliki semua akses Guru, ditambah kemampuan memantau kelas yang ia pegang secara menyeluruh.

**Perbedaan dari Guru biasa:**
- Bisa melihat absensi & nilai **semua mapel** di kelasnya (bukan hanya mapel yang ia ajar)
- Bisa melihat rekap poin perilaku seluruh siswa di kelasnya
- Bisa mencetak/export laporan kelas

| Halaman | Akses |
|---|---|
| `/absensi` | ✅ Lihat & catat absensi (semua mapel di kelasnya) |
| `/siswa` | ✅ Lihat data siswa kelasnya; ❌ tidak bisa hapus/pindah kelas |
| `/poin` | ✅ Lihat & tambah poin siswa kelasnya |
| `/laporan` | ✅ Lihat laporan absensi, nilai, & jurnal kelasnya |
| `/jadwal` | ✅ Lihat jadwal kelasnya |
| `/jurnal` | 👁️ Lihat jurnal mengajar semua guru di kelasnya |
| `/penilaian` | ❌ Tidak bisa input nilai (milik guru mapel) |
| `/admin` | ❌ Tidak ada akses |
| `/soal`, `/tugas` | ❌ Tidak ada akses (milik guru mapel) |

**Relasi database:**
```sql
-- Tabel baru: wali_kelas
CREATE TABLE wali_kelas (
  id           SERIAL PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_kelas     TEXT NOT NULL REFERENCES kelas(id_kelas) ON DELETE CASCADE,
  tahun_ajar_id TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tahun_ajar_id) -- satu guru hanya boleh jadi wali kelas satu kelas per tahun ajar
);
```

---

### 🎓 Kepala Sekolah

> Pemimpin lembaga. Akses **baca (read-only) penuh** ke seluruh data sekolah untuk keperluan monitoring dan pengambilan keputusan.

**Prinsip: Bisa lihat segalanya, tidak bisa mengubah apapun.**

| Halaman | Akses |
|---|---|
| `/admin/pengguna` | 👁️ Lihat daftar pengguna; ❌ tidak bisa tambah/edit/hapus |
| `/admin/penugasan` | 👁️ Lihat peta penugasan KBM |
| `/admin/tahun-ajar` | 👁️ Lihat tahun ajar aktif |
| `/siswa` | 👁️ Lihat semua data siswa semua kelas |
| `/kelas`, `/mapel` | 👁️ Lihat daftar kelas & mata pelajaran |
| `/absensi` | 👁️ Lihat rekap absensi semua kelas |
| `/poin` | 👁️ Lihat rekap poin semua siswa |
| `/laporan` | 👁️ Akses penuh baca semua laporan (Absensi, Nilai, Jurnal) |
| `/jadwal` | 👁️ Lihat semua jadwal |
| `/jurnal` | 👁️ Lihat semua jurnal mengajar semua guru |
| Export PDF/Excel | ✅ Bisa export semua laporan |
| `/catatan`, `/soal`, `/tugas` | ❌ Tidak perlu akses (operasional guru) |

**Catatan implementasi:**
Di setiap API route, tambahkan `'Kepala Sekolah'` ke dalam daftar role yang boleh mengakses GET, tetapi **jangan** sertakan untuk POST/PUT/DELETE.

```js
// Contoh di API route:
const readRoles  = ['Admin', 'Kepala Sekolah', 'Guru'];
const writeRoles = ['Admin'];

if (req.method === 'GET' && !readRoles.includes(role))  return 403;
if (req.method !== 'GET' && !writeRoles.includes(role)) return 403;
```

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
Kepala Sekolah ──── View all (no edit)
      │
      ├─── Wakasek Kurikulum ── Jadwal, mapel, nilai
      └─── Wakasek Kesiswaan ── Siswa, poin, absensi

Admin ──────────────── Full access + kelola sistem & pengguna
      │
      └─── Tata Usaha ──── Data siswa, berkas

Guru ────────────────── Fitur mengajar (kelas yang diajar)
      ├─── Wali Kelas ── + monitoring menyeluruh kelas yang dipegang
      └─── Guru BK ───── + monitoring perilaku semua siswa

Keamanan ───────────── Absensi gerbang saja

Wali Murid ─────────── Data anak sendiri saja
Siswa ──────────────── Data diri sendiri saja
```

---

## 5. Perubahan Database

### 5.1. Nilai Enum Role Baru di `public.users`

Kolom `role` di tabel `users` perlu menerima nilai-nilai baru berikut:

```sql
-- Role yang sudah ada:
'Admin' | 'Guru'

-- Role baru Tahap 1:
'Wali Kelas' | 'Kepala Sekolah' | 'Wali Murid' | 'Keamanan'

-- Role baru Tahap 2:
'Guru BK' | 'Tata Usaha' | 'Siswa' | 'Wakasek'
```

> Jika kolom `role` menggunakan tipe ENUM di Supabase, tambahkan nilai baru via:
> ```sql
> ALTER TYPE user_role ADD VALUE 'Wali Kelas';
> ALTER TYPE user_role ADD VALUE 'Kepala Sekolah';
> -- dst.
> ```
> Jika menggunakan `TEXT`, tidak perlu perubahan tipe — langsung bisa digunakan.

### 5.2. Tabel Baru

```sql
-- Relasi Wali Kelas ke Kelas
CREATE TABLE IF NOT EXISTS wali_kelas (
  id            SERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_kelas      TEXT NOT NULL REFERENCES kelas(id_kelas) ON DELETE CASCADE,
  tahun_ajar_id TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tahun_ajar_id)
);

-- Relasi Wali Murid ke Siswa
CREATE TABLE IF NOT EXISTS wali_murid (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, id_siswa)
);

-- Relasi Siswa (akun) ke Data Siswa
CREATE TABLE IF NOT EXISTS siswa_auth (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id_siswa)
);

-- Catatan konseling Guru BK (opsional)
CREATE TABLE IF NOT EXISTS catatan_bk (
  id         SERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id_user), -- guru BK yang mencatat
  id_siswa   TEXT NOT NULL REFERENCES siswa(id_siswa),
  isi        TEXT NOT NULL,
  tanggal    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Perubahan Middleware & API

### 6.1. Konstanta Role (buat file baru)

Buat file `src/lib/roles.js` untuk sentralisasi konstanta role:

```js
// src/lib/roles.js

export const ROLES = {
  ADMIN:          'Admin',
  GURU:           'Guru',
  WALI_KELAS:     'Wali Kelas',
  KEPALA_SEKOLAH: 'Kepala Sekolah',
  WALI_MURID:     'Wali Murid',
  KEAMANAN:       'Keamanan',
  GURU_BK:        'Guru BK',
  TATA_USAHA:     'Tata Usaha',
  SISWA:          'Siswa',
  WAKASEK:        'Wakasek',
};

// Pengelompokan untuk kemudahan cek akses
export const STAFF_ROLES    = [ROLES.ADMIN, ROLES.GURU, ROLES.WALI_KELAS, ROLES.KEPALA_SEKOLAH, ROLES.GURU_BK, ROLES.TATA_USAHA, ROLES.WAKASEK, ROLES.KEAMANAN];
export const READ_ALL_ROLES = [ROLES.ADMIN, ROLES.KEPALA_SEKOLAH, ROLES.WAKASEK];
export const GURU_ROLES     = [ROLES.ADMIN, ROLES.GURU, ROLES.WALI_KELAS, ROLES.GURU_BK];
```

### 6.2. Middleware Routing

Update `middleware.js` untuk mengarahkan setiap role ke halaman yang sesuai setelah login:

```js
// Peta redirect setelah login berdasarkan role
const ROLE_HOME = {
  'Admin':          '/admin',
  'Guru':           '/',
  'Wali Kelas':     '/',
  'Kepala Sekolah': '/laporan',
  'Wali Murid':     '/wali-murid',
  'Keamanan':       '/keamanan',
  'Guru BK':        '/poin',
  'Tata Usaha':     '/siswa',
  'Siswa':          '/siswa-portal',
  'Wakasek':        '/laporan',
};

// Route yang diblokir per role
const BLOCKED_ROUTES = {
  'Kepala Sekolah': ['/admin/pengguna', '/penilaian', '/soal', '/tugas'],
  'Wali Murid':     ['/admin', '/siswa', '/penilaian', '/jurnal'],
  'Keamanan':       ['/admin', '/penilaian', '/nilai', '/jurnal', '/soal'],
  'Guru BK':        ['/admin', '/penilaian', '/soal'],
  'Tata Usaha':     ['/admin/pengguna', '/penilaian', '/soal', '/jurnal'],
  'Siswa':          ['/admin', '/penilaian', '/jurnal', '/soal', '/tugas'],
};
```

### 6.3. Pola Pengecekan di API Route

```js
// Pola standar untuk API yang punya akses read-only untuk beberapa role:
export async function GET(req) {
  const role = req.headers.get('x-user-role');
  const allowedRoles = ['Admin', 'Kepala Sekolah', 'Guru', 'Wali Kelas'];
  
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
  }
  // ... logika GET
}

export async function POST(req) {
  const role = req.headers.get('x-user-role');
  const writeRoles = ['Admin', 'Guru']; // hanya Admin & Guru yang boleh write
  
  if (!writeRoles.includes(role)) {
    return NextResponse.json({ error: 'Akses Ditolak.' }, { status: 403 });
  }
  // ... logika POST
}
```

---

## 7. Perubahan UI

### 7.1. Dropdown Role di `/admin/pengguna`

```jsx
// Tambahkan opsi role baru di form tambah/edit pengguna
const ROLE_OPTIONS = [
  { value: 'Admin',          label: 'Admin' },
  { value: 'Guru',           label: 'Guru' },
  { value: 'Wali Kelas',     label: 'Wali Kelas' },
  { value: 'Kepala Sekolah', label: 'Kepala Sekolah' },
  { value: 'Wali Murid',     label: 'Wali Murid' },
  { value: 'Keamanan',       label: 'Keamanan' },
  // Tahap 2:
  // { value: 'Guru BK',     label: 'Guru BK' },
  // { value: 'Tata Usaha',  label: 'Tata Usaha' },
  // { value: 'Siswa',       label: 'Siswa' },
  // { value: 'Wakasek',     label: 'Wakasek' },
];
```

### 7.2. Halaman Baru yang Perlu Dibuat

| Route | Untuk Role | Deskripsi |
|---|---|---|
| `/wali-murid` | Wali Murid | Portal orang tua — ringkasan anak |
| `/wali-murid/[id_siswa]` | Wali Murid | Detail data satu anak |
| `/keamanan` | Keamanan | Dashboard absensi gerbang |
| `/siswa-portal` | Siswa | Portal siswa — data akademik diri sendiri |

### 7.3. Warna Badge Role (UI Konsistensi)

```jsx
const ROLE_COLORS = {
  'Admin':          'bg-red-200 text-red-800',
  'Guru':           'bg-blue-200 text-blue-800',
  'Wali Kelas':     'bg-teal-200 text-teal-800',
  'Kepala Sekolah': 'bg-purple-200 text-purple-800',
  'Wali Murid':     'bg-orange-200 text-orange-800',
  'Keamanan':       'bg-gray-200 text-gray-800',
  'Guru BK':        'bg-green-200 text-green-800',
  'Tata Usaha':     'bg-yellow-200 text-yellow-800',
  'Siswa':          'bg-pink-200 text-pink-800',
  'Wakasek':        'bg-indigo-200 text-indigo-800',
};
```

---

## 8. Prioritas Implementasi

| Urutan | Role | Kompleksitas | Alasan |
|---|---|---|---|
| 1 | **Kepala Sekolah** | 🟢 Rendah | Hanya view-only, tidak butuh tabel baru, tinggal tambah ke allowedRoles di API |
| 2 | **Wali Kelas** | 🟡 Sedang | Butuh tabel `wali_kelas`, filter data berdasarkan kelas yang dipegang |
| 3 | **Keamanan** | 🟡 Sedang | Butuh halaman `/keamanan` baru, logika absensi gerbang |
| 4 | **Guru BK** | 🟡 Sedang | Akses data poin & absensi semua siswa, opsional tabel `catatan_bk` |
| 5 | **Tata Usaha** | 🟡 Sedang | Akses CRUD siswa & berkas, mirip Admin tapi terbatas |
| 6 | **Wali Murid** | 🔴 Tinggi | Butuh tabel `wali_murid`, halaman portal `/wali-murid`, filter ketat per anak |
| 7 | **Siswa** | 🔴 Tinggi | Butuh tabel `siswa_auth`, halaman portal `/siswa-portal` |
| 8 | **Wakasek** | 🟡 Sedang | Definisi akses perlu dikonfirmasi dengan kebutuhan sekolah |

---

*Dokumen ini diperbarui terakhir: Oktober 2026*  
*Untuk pertanyaan implementasi, lihat file `src/lib/auth.js` dan `src/app/api/users/route.js`*
