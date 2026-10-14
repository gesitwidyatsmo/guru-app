# Sistem Poin — Desain & Rencana Integrasi

> Dokumen ini menjelaskan filosofi sistem poin yang ada, keputusan desain terkait siapa yang boleh memberi poin, dan rencana integrasi poin ke dalam nilai akhir/raport siswa.

---

## Daftar Isi

1. [Kondisi Saat Ini](#1-kondisi-saat-ini)
2. [Pertanyaan: Siapa yang Boleh Memberi Poin?](#2-pertanyaan-siapa-yang-boleh-memberi-poin)
3. [Filosofi & Tujuan Sistem Poin](#3-filosofi--tujuan-sistem-poin)
4. [Opsi Integrasi ke Nilai Akhir](#4-opsi-integrasi-ke-nilai-akhir)
5. [Keputusan Desain yang Dipilih](#5-keputusan-desain-yang-dipilih)
6. [Skema Konversi Poin](#6-skema-konversi-poin)
7. [Implementasi Teknis](#7-implementasi-teknis)
8. [Perubahan yang Diperlukan](#8-perubahan-yang-diperlukan)

---

## 1. Kondisi Saat Ini

### Apa yang sudah ada:
- Tabel `poin` di Supabase dengan kolom: `siswa_id`, `guru_id`, `tanggal`, `tipe` (positif/negatif), `kategori`, `aktifitas`, `poin`, `keterangan`, `tahun_ajar`, `semester`
- Kategori poin diambil dari **Google Sheets** (`daftar_kategori_positif`, `daftar_kategori_minus`, `badge_poin`)
- Poin sudah difilter per **tahun ajar & semester** (selaras dengan sistem akademik)
- Bisa input poin untuk **satu atau banyak siswa sekaligus** (`siswa_ids`)
- Ada sistem **badge/reward** untuk pencapaian tertentu

### Yang belum ada:
- ❌ Koneksi ke `nilai_siswa` atau `nilai_tugas`
- ❌ Poin belum mempengaruhi nilai akhir raport sama sekali
- ❌ Tidak ada ringkasan "total poin bersih per siswa per semester"
- ❌ Tidak ada predikat sikap yang dihasilkan dari poin

---

## 2. Pertanyaan: Siapa yang Boleh Memberi Poin?

### ❓ Mengapa Wali Kelas ada di daftar pemberi poin?

Di dokumen desain role sebelumnya, **Wali Kelas** ditulis bisa "Lihat & tambah poin siswa kelasnya". Ini perlu diklarifikasi.

### Jawaban: Wali Kelas SEBAIKNYA bisa tambah poin, tapi dengan batasan

Alasannya:

**Di dunia nyata,** Wali Kelas adalah:
- Guru yang **paling mengenal** karakter dan perilaku siswa di kelasnya
- Penanggungjawab **pembinaan karakter** kelas yang ia pegang
- Orang yang **paling sering berinteraksi** langsung dengan siswa (bukan hanya saat jam pelajarannya)
- Di banyak sekolah, Wali Kelas yang **merekap dan melaporkan** nilai sikap ke raport

**Analogi:** Guru Mapel memberi poin saat siswa berbuat sesuatu di jam pelajarannya. Wali Kelas memberi poin untuk hal-hal di luar jam pelajaran — misalnya siswa membantu teman, terlambat masuk kelas, atau membawa atribut tidak lengkap.

### Matriks Hak Akses Poin yang Benar

| Role | Lihat Poin | Tambah Poin | Edit/Hapus | Batasan |
|---|---|---|---|---|
| **Admin** | ✅ Semua | ✅ Semua | ✅ Semua | Tidak ada |
| **Guru** | ✅ Kelas yang diajar + buatan sendiri | ✅ Ya | ✅ Hanya buatan sendiri | Hanya siswa di kelas yang ia ajar (via KBM) |
| **Wali Kelas** | ✅ Semua siswa di kelasnya | ✅ Ya | ✅ Buatan sendiri + semua poin di kelasnya | Hanya siswa di kelas yang ia pegang |
| **Guru BK** | ✅ Semua siswa semua kelas | ✅ Ya | ✅ Hanya buatan sendiri | Tidak ada batasan kelas |
| **Kepala Sekolah** | 👁️ Semua | ❌ Tidak | ❌ Tidak | View only |
| **Wali Murid** | 👁️ Hanya anak sendiri | ❌ Tidak | ❌ Tidak | Hanya anaknya |
| **Siswa** | 👁️ Hanya diri sendiri | ❌ Tidak | ❌ Tidak | Hanya dirinya |
| **Keamanan** | ❌ | ❌ | ❌ | Tidak perlu akses poin |

### Perbedaan Wali Kelas vs Guru Biasa dalam Poin

```
Guru Biasa:
  → Hanya bisa tambah poin untuk siswa di kelas yang ia AJAR (via penugasan KBM)
  → Contoh: Pak Budi mengajar Matematika di 7A dan 8B
             → Pak Budi hanya bisa beri poin ke siswa 7A dan 8B

Wali Kelas:
  → Bisa tambah poin untuk SEMUA siswa di kelas yang ia PEGANG
  → Tidak harus punya penugasan KBM di kelas itu
  → Contoh: Bu Sari adalah wali kelas 9C
             → Bu Sari bisa beri poin ke semua siswa 9C
             → Walaupun Bu Sari tidak mengajar mapel apapun di 9C
```

> **Kesimpulan:** Wali Kelas perlu bisa tambah poin. Ini bukan bug desain, ini fitur yang benar. Yang penting batasannya jelas — hanya untuk kelas yang dipegang, bukan semua kelas.

---

## 3. Filosofi & Tujuan Sistem Poin

Sistem poin di aplikasi ini **bukan sistem gamifikasi murni** (bukan poin reward seperti game). Tujuannya adalah:

1. **Dokumentasi perilaku siswa** yang terstruktur dan teraudit
2. **Input untuk nilai sikap** di raport (sesuai kurikulum Merdeka/K13)
3. **Alat pembinaan** yang bisa dilihat oleh Wali Murid dan siswa sendiri
4. **Rekam jejak** untuk keperluan BK jika ada siswa bermasalah

### Kategori Poin yang Ada

Berdasarkan struktur Google Sheets:
- **Positif:** Prestasi akademik, prestasi non-akademik, sikap terpuji, partisipasi
- **Negatif:** Keterlambatan, pelanggaran tata tertib, tidak mengerjakan tugas
- **Badge:** Penghargaan khusus untuk pencapaian tertentu

---

## 4. Opsi Integrasi ke Nilai Akhir

### Opsi A — Poin Mempengaruhi Nilai Akademik Langsung

```
Nilai Akhir = Rata-rata Nilai Akademik ± Bonus/Penalti dari Poin
```

**Contoh:**
| Siswa | Rata Nilai | Poin Bersih | Konversi | Nilai Akhir |
|---|---|---|---|---|
| Andi | 80 | +30 poin | +3.0 | 83.0 |
| Budi | 75 | -20 poin | -2.0 | 73.0 |
| Cici | 90 | +5 poin | +0.5 | 90.5 |

**Kelebihan:** Poin terasa "nyata", siswa termotivasi  
**Kekurangan:**
- ⚠️ Nilai akademik bisa terdistorsi — siswa rajin tapi bodoh bisa dapat nilai lebih tinggi secara artifisial
- ⚠️ Tidak sesuai standar raport Indonesia yang memisahkan nilai kognitif dan sikap
- ⚠️ Rentan dimanipulasi (guru bisa menaikkan nilai lewat poin, bukan tes)

---

### Opsi B — Poin Menjadi Nilai Sikap Tersendiri ✅ DIREKOMENDASIKAN

Poin **tidak mengubah nilai akademik**, tapi menghasilkan **predikat nilai sikap** yang tampil terpisah di raport. Ini sesuai struktur raport Kurikulum Merdeka dan K13.

```
Raport:
  ├── Nilai Kognitif  → angka (dari nilai_tugas, rata-rata per mapel)
  ├── Nilai Sikap     → predikat A/B/C/D (dari akumulasi poin semester ini)
  └── Nilai Praktik   → angka (jika ada, dari nilai_tugas type='praktik')
```

**Konversi poin ke predikat:**

| Total Poin Bersih (semester) | Predikat | Label |
|---|---|---|
| ≥ +50 | **A** | Sangat Baik |
| +10 s/d +49 | **B** | Baik |
| -9 s/d +9 | **C** | Cukup |
| ≤ -10 | **D** | Perlu Bimbingan |

**Kelebihan:**
- ✅ Sesuai standar raport nasional
- ✅ Nilai akademik murni, tidak terdistorsi
- ✅ Siswa dan orang tua bisa melihat dampak perilaku secara transparan
- ✅ Data poin tetap tersimpan lengkap untuk keperluan BK

**Kekurangan:**
- Pengaruhnya tidak langsung ke angka (tapi ini justru benar secara pedagogis)

---

### Opsi C — Hybrid (Nilai Sikap + Bonus Opsional)

Kombinasi Opsi A dan B. Admin bisa mengaktifkan **bonus nilai opsional** dengan batas maksimal yang bisa dikonfigurasi.

```
Raport:
  ├── Nilai Kognitif  → angka murni dari tugas/ulangan
  ├── Nilai Sikap     → predikat A/B/C/D dari poin
  └── Bonus Poin      → opsional, maks ±N poin (dikonfigurasi Admin)
                        hanya aktif jika Admin mengaktifkan fitur ini
```

**Pengaturan di Admin:**
```
[x] Tampilkan predikat sikap di laporan nilai
[ ] Aktifkan pengaruh poin ke nilai akhir akademik
    └── Batas maksimal: [5] poin  (range: 1-10)
    └── Rasio konversi: [10] poin = 1 nilai
```

---

## 5. Keputusan Desain yang Dipilih

> **Implementasikan Opsi B sekarang, siapkan infrastruktur untuk Opsi C nanti.**

**Alasan:**
1. Opsi B tidak mengubah struktur tabel yang sudah ada
2. Cukup tambah satu fungsi kalkulasi di sisi API
3. Selaras dengan kurikulum yang berlaku di Indonesia
4. Opsi C bisa ditambahkan kemudian hanya dengan menambah tabel `pengaturan_poin` tanpa merombak yang sudah ada

---

## 6. Skema Konversi Poin

### 6.1. Kalkulasi Total Poin Bersih per Siswa per Semester

```
Total Poin Bersih = Σ(poin positif) - Σ(poin negatif)
                    dalam satu semester dan tahun ajar yang sama
```

**Contoh:**

| Tanggal | Tipe | Aktivitas | Poin |
|---|---|---|---|
| 2026-08-05 | Positif | Juara lomba MTK | +20 |
| 2026-08-15 | Negatif | Terlambat 3x | -15 |
| 2026-09-01 | Positif | Membantu teman | +5 |
| 2026-09-20 | Negatif | Tidak pakai seragam | -5 |

```
Total Poin Bersih = (20 + 5) - (15 + 5) = 5 → Predikat C (Cukup)
```

### 6.2. Tabel Predikat Lengkap

| Poin Bersih | Predikat | Label | Warna UI |
|---|---|---|---|
| ≥ 50 | **A** | Sangat Baik | 🟢 Hijau |
| 10 s/d 49 | **B** | Baik | 🔵 Biru |
| -9 s/d 9 | **C** | Cukup | 🟡 Kuning |
| ≤ -10 | **D** | Perlu Bimbingan | 🔴 Merah |

> **Catatan:** Ambang batas ini bisa dikonfigurasi per sekolah di masa mendatang. Untuk sekarang, nilai di atas adalah default yang masuk akal.

### 6.3. Konversi Bonus (untuk Opsi C di masa mendatang)

```js
// Rumus: setiap 10 poin bersih = 1 poin nilai
// Maksimum ±5 nilai (bisa dikonfigurasi)
bonusNilai = clamp(totalPoinBersih / 10, -maxBonus, +maxBonus)
```

---

## 7. Implementasi Teknis

### 7.1. File Baru: `src/lib/poinUtils.js`

```js
/**
 * Hitung total poin bersih seorang siswa dalam satu periode
 * @param {Array} poinList - Array poin dari tabel `poin`
 * @returns {number} Total poin bersih (positif dikurangi negatif)
 */
export function hitungTotalPoinBersih(poinList) {
  return poinList.reduce((total, item) => {
    const nilai = parseInt(item.poin || 0, 10);
    return item.tipe === 'positif' ? total + nilai : total - nilai;
  }, 0);
}

/**
 * Konversi total poin bersih ke predikat sikap
 * @param {number} totalPoinBersih
 * @returns {{ predikat: string, label: string, warna: string }}
 */
export function konversiPoinKeSikap(totalPoinBersih) {
  if (totalPoinBersih >= 50) return { predikat: 'A', label: 'Sangat Baik',      warna: 'green' };
  if (totalPoinBersih >= 10) return { predikat: 'B', label: 'Baik',             warna: 'blue'  };
  if (totalPoinBersih >= -9) return { predikat: 'C', label: 'Cukup',            warna: 'yellow'};
  return                            { predikat: 'D', label: 'Perlu Bimbingan',  warna: 'red'   };
}

/**
 * Konversi total poin bersih ke bonus/penalti nilai (untuk Opsi C)
 * @param {number} totalPoinBersih
 * @param {number} maxBonus - Batas maksimal pengaruh (default: 5)
 * @param {number} rasio    - Berapa poin = 1 nilai (default: 10)
 * @returns {number} Bonus/penalti nilai (misal: +2.5 atau -3.0)
 */
export function konversiPoinKeBonus(totalPoinBersih, maxBonus = 5, rasio = 10) {
  const raw = totalPoinBersih / rasio;
  return Math.max(-maxBonus, Math.min(maxBonus, parseFloat(raw.toFixed(1))));
}
```

### 7.2. Update API: `GET /api/nilai/rekap`

Tambahkan join data poin saat menghasilkan rekap nilai per siswa:

```js
// Di dalam GET /api/nilai/rekap/route.js
// Setelah mengambil nilaiSiswaRaw, tambahkan:

// Ambil data poin untuk periode yang sama
const { data: poinData } = await supabase
  .from('poin')
  .select('siswa_id, tipe, poin')
  .eq('tahun_ajar', tahun_ajar)
  .eq('semester', semester);

// Kelompokkan poin per siswa
const poinPerSiswa = {};
(poinData || []).forEach(p => {
  if (!poinPerSiswa[p.siswa_id]) poinPerSiswa[p.siswa_id] = [];
  poinPerSiswa[p.siswa_id].push(p);
});

// Saat membangun rekapSiswa, tambahkan:
const rekapSiswa = siswaDiKelas.map(siswa => {
  // ... kalkulasi nilai yang sudah ada ...
  
  const poinSiswa = poinPerSiswa[siswa.id] || [];
  const totalPoinBersih = hitungTotalPoinBersih(poinSiswa);
  const predikatSikap = konversiPoinKeSikap(totalPoinBersih);
  
  return {
    ...siswa,
    nilai: nilaiSiswa,
    avg: avg,
    countNilai: countNilai,
    // Tambahan baru:
    totalPoinBersih,
    predikatSikap,        // { predikat: 'B', label: 'Baik', warna: 'blue' }
    poinPositif: poinSiswa.filter(p => p.tipe === 'positif').reduce((s, p) => s + p.poin, 0),
    poinNegatif: poinSiswa.filter(p => p.tipe === 'negatif').reduce((s, p) => s + p.poin, 0),
  };
});
```

### 7.3. Update Tampilan Rekap Nilai

Di halaman `/laporan` (Tab **Nilai**), tambahkan kolom **Nilai Sikap (Poin)** di tabel rekap:

```jsx
// Kolom tambahan di tabel rekap nilai
<th>Nilai Sikap (Poin)</th>

// Cell per siswa
<td>
  <span className={siswa.predikatSikap.badgeClass}>
    {siswa.predikatSikap.predikat} ({siswa.predikatSikap.label})
  </span>
  <span>
    {siswa.totalPoinBersih > 0 ? '+' : ''}{siswa.totalPoinBersih} pts
  </span>
</td>
```

### 7.4. Update API Poin untuk Filter Role

Di `GET /api/poin/route.js`, tambahkan pengecekan role Wali Kelas yang lebih ketat:

```js
// Saat ini: Guru hanya bisa lihat poin buatannya + kelas yang ia punya id_wali_kelas
// Perlu update: Role "Wali Kelas" harus bisa lihat SEMUA poin di kelasnya
// (tidak hanya yang ia buat, dan tidak perlu cek id_wali_kelas di tabel kelas)

if (role === 'Guru') {
  // Guru biasa: filter via penugasan KBM
  const { data: kbmData } = await supabase
    .from('guru_kbm')
    .select('kelas')
    .eq('id_user', userId);
  const allowedClasses = (kbmData || []).map(r => r.kelas);
  result = result.filter(d => allowedClasses.includes(d._kelas) || d.guru_id === userId);

} else if (role === 'Wali Kelas') {
  // Wali Kelas: filter via tabel wali_kelas (tabel baru)
  const { data: wkData } = await supabase
    .from('wali_kelas')
    .select('id_kelas')
    .eq('user_id', userId)
    .eq('tahun_ajar_id', tahunAjarAktif);
  const kelasIds = (wkData || []).map(r => r.id_kelas);
  // Lalu filter siswa berdasarkan kelasIds
  result = result.filter(d => kelasIds.includes(d._kelas_id));
}
// Admin, Kepala Sekolah, Guru BK: tidak difilter (lihat semua)
```

---

## 8. Perubahan yang Diperlukan

### Ringkasan Perubahan

| File | Perubahan | Prioritas |
|---|---|---|
| `src/lib/poinUtils.js` | **Buat baru** — fungsi kalkulasi & konversi poin | 🔴 Harus |
| `src/app/api/nilai/rekap/route.js` | Tambahkan join data poin ke rekap | 🔴 Harus |
| `src/app/laporan/page.jsx` | Tampilkan kolom Nilai Sikap di Tab Nilai | 🔴 Harus |
| `src/app/api/poin/route.js` | Update filter role untuk Wali Kelas & Guru BK | 🟡 Segera |
| `src/app/poin/page.jsx` | Tampilkan total poin bersih & predikat per siswa | 🟡 Segera |
| `src/app/api/nilai/rekap/route.js` | Sertakan `tahun_ajar` & `semester` di query | 🟡 Segera |
| Tabel `wali_kelas` (Supabase) | **Buat tabel baru** (lihat `docs/ROLES.md`) | 🟡 Segera |
| `src/app/admin/pengaturan-poin` | Halaman config ambang batas predikat (Opsi C) | ⚪ Nanti |
| Kolom `bonus_poin_aktif` di tabel settings | Untuk toggle Opsi C | ⚪ Nanti |

### Urutan Pengerjaan yang Disarankan

```
1. Buat src/lib/poinUtils.js
   └── Fungsi hitungTotalPoinBersih, konversiPoinKeSikap

2. Update GET /api/nilai/rekap
   └── Join data poin, hitung predikat per siswa

3. Update UI /laporan (Tab Nilai)
   └── Tampilkan kolom Nilai Sikap & legenda predikat sikap

4. Update GET /api/poin
   └── Pisahkan logika filter untuk role Wali Kelas vs Guru biasa

5. Update UI /poin
   └── Tampilkan ringkasan total poin bersih + predikat per siswa
```

---

*Dokumen ini diperbarui terakhir: Oktober 2026*  
*Lihat juga: `docs/ROLES.md` untuk desain lengkap sistem role*
