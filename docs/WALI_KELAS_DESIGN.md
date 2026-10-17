# 📘 Desain & Rencana Implementasi: Hub & Peran Wali Kelas (Guru App)

> **Dokumen Teknis:** Rekomendasi Arsitektur & Panduan Implementasi Fitur Wali Kelas  
> **Pendekatan:** **Hybrid Role (Guru Pengajar + Hub Kelas Binaan `/wali-kelas`)**

---

## 1. Analisis & Rekomendasi Arsitektur

### 1.1. Perbandingan Opsi

| Kriteria | Opsi 1: Role Mandiri (`role = 'Wali Kelas'`) | Opsi 2: Status Quo (Tombol di `/kelas/[id]`) | Opsi 3 (Rekomendasi ⭐): **Hybrid Role + Hub Khusus `/wali-kelas`** |
| :--- | :--- | :--- | :--- |
| **Identitas Akun** | Terpisah (guru butuh 2 akun atau switch role) | Melekat di Guru | **Melekat di Guru (Single Identity SSO)** |
| **Beban KBM Mapel** | Perlu duplikasi otorisasi di seluruh route KBM | Normal | **Normal (akses mengajar, jadwal, & jurnal tidak terganggu)** |
| **Ruang Kerja (Workspace)** | Dashboard mandiri terpisah | Tersebar di tombol detail kelas | **Satu Hub Terpadu (`/wali-kelas`)** |
| **Histori Multi-Tahun** | Tidak fleksibel | Tertimpa saat ganti tahun ajaran | **Tersimpan rapi via tabel relasi per tahun ajaran** |
| **Leger Nilai Lintas Mapel** | Tidak tersedia | Tidak tersedia | **Tersedia (wali kelas dapat memantau nilai dari seluruh guru)** |
| **Bisaroh / Keuangan** | Perlu mapping akun ganda | Sudah otomatis terhitung | **Otomatis & tersinkronisasi presisi** |

### 1.2. Alasan Memilih Opsi 3 (Hybrid Role)
1. **Karakter Asli Sekolah:** Wali kelas pada dasarnya adalah Guru Mata Pelajaran. Menjadikannya role akun terpisah akan memaksa guru berganti-ganti akun saat ingin mengisi jurnal KBM mapelnya sendiri.
2. **Kebutuhan Sentralisasi:** Wali kelas saat ini harus membuka banyak menu berbeda untuk mengontrol absensi harian, poin, dan nilai. Dibutuhkan satu gerbang: **Hub Wali Kelas (`/wali-kelas`)**.
3. **Leger Nilai Lintas Mapel:** Masalah klasik wali kelas menjelang pembagian rapor adalah memantau guru mapel mana yang belum menuntaskan penilaian siswa kelasnya. Hub ini menyediakan *cross-subject grade tracking*.

---

## 2. Diagram Alur Sistem

```mermaid
flowchart TD
    User([Guru Login]) --> Proxy[Middleware / Proxy]
    Proxy --> CheckRole{Cek Role di users}
    CheckRole -->|Admin| AdminDash[/admin]
    CheckRole -->|Kepsek| KepsekDash[/kepsek]
    CheckRole -->|Bendahara| BendaharaDash[/bendahara]
    CheckRole -->|Guru| GuruHome[/]

    GuruHome --> CheckWali{Punya Rombel Binaan Aktif?}
    CheckWali -->|Tidak| StandardGuru[Mode Guru Pengajar Biasa]
    CheckWali -->|Ya| WaliBanner["Card & Banner Hub: Wali Kelas [X]"]
    
    WaliBanner --> WaliHub["Hub Wali Kelas (/wali-kelas)"]

    subgraph Modul Hub Wali Kelas
        WaliHub --> Tab1["📊 Ringkasan & Early Warning"]
        WaliHub --> Tab2["📅 Absensi Harian Rombel"]
        WaliHub --> Tab3["📑 Leger Nilai Lintas Mapel"]
        WaliHub --> Tab4["🛡️ Poin Sikap & Catatan BK"]
        WaliHub --> Tab5["👥 Data Siswa & Kontak Ortu"]
        WaliHub --> Tab6["🖨️ Cetak Buku Kelas / Rapor"]
    end
```

---

## 3. Perubahan Skema Database

### 3.1. DDL Tabel `wali_kelas` (Multi-Tahun Ajaran)

```sql
-- 1. Buat tabel penugasan wali kelas berbasis periode
CREATE TABLE IF NOT EXISTS public.wali_kelas (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES public.users(id_user) ON DELETE CASCADE,
    id_kelas TEXT NOT NULL REFERENCES public.kelas(id) ON DELETE CASCADE,
    tahun_ajar_id TEXT REFERENCES public.tahun_ajar(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tahun_ajar_id, is_active)
);

CREATE INDEX IF NOT EXISTS idx_wali_kelas_user ON public.wali_kelas(user_id);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_kelas ON public.wali_kelas(id_kelas);
CREATE INDEX IF NOT EXISTS idx_wali_kelas_active ON public.wali_kelas(is_active);

-- 2. Trigger Sinkronisasi Cache ke public.kelas (Backward Compatibility)
CREATE OR REPLACE FUNCTION sync_kelas_wali_cache()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.is_active = TRUE THEN
        UPDATE public.kelas 
        SET id_wali_kelas = NEW.user_id,
            wali_kelas = (SELECT nama_lengkap FROM public.users WHERE id_user = NEW.user_id)
        WHERE id = NEW.id_kelas;
    ELSIF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.is_active = FALSE) THEN
        UPDATE public.kelas 
        SET id_wali_kelas = NULL,
            wali_kelas = NULL
        WHERE id = OLD.id_kelas AND id_wali_kelas = OLD.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_kelas_wali ON public.wali_kelas;
CREATE TRIGGER trg_sync_kelas_wali
AFTER INSERT OR UPDATE OR DELETE ON public.wali_kelas
FOR EACH ROW EXECUTE FUNCTION sync_kelas_wali_cache();
```

---

## 4. Desain Modul Antarmuka (`/wali-kelas`)

### 4.1. Card Shortcut di Beranda Guru (`/`)
Ketika guru login memiliki rombel binaan aktif:
* Di atas jadwal KBM, tampil kartu Neobrutalisme mencolok:
  * Badge: `🌟 WALI KELAS AKTIF • ROMBEL 8-B`
  * Indikator cepat: *32 Siswa • 2 Izin Hari Ini • 1 Perlu Perhatian*
  * Tombol: `[ Buka Hub Wali Kelas ➜ ]`

### 4.2. 5 Tab Utama di Hub `/wali-kelas`
1. **Radar Masalah & Early Warning:**
   * Rekap absensi hari ini (Hadir/Sakit/Izin/Alfa).
   * Siswa yang sering tidak masuk berturut-turut ($\ge 3$ hari).
   * Siswa dengan akumulasi poin pelanggaran tinggi.
2. **Presensi Harian Terpadu:**
   * Input presensi harian kelas langsung tanpa harus ke halaman `/kelas/[id]`.
   * Cetak rekap presensi per bulan / semester.
3. **Leger Nilai Lintas Mapel (Cross-Subject Gradebook):**
   * Matriks tabel seluruh siswa $\times$ seluruh mata pelajaran.
   * Highlight merah jika ada nilai siswa di bawah KKM/KKTP.
   * Indikator mata pelajaran yang belum menyelesaikan penilaian.
4. **Buku Pembinaan & Koordinasi BK:**
   * Form catatan konseling/pembinaan wali kelas.
   * Koordinasi catatan khusus dengan Guru BK.
5. **Direktori Siswa & Kontak Wali Murid:**
   * Data NISN, alamat, serta tombol WhatsApp instan ke nomor orang tua/wali murid.

---

## 5. Rencana Endpoint API Baru

| Endpoint | Method | Akses | Fungsi |
| :--- | :--- | :--- | :--- |
| `/api/wali-kelas/my-class` | `GET` | Guru (Wali Kelas) | Ambil rombel binaan aktif, rekap live auto-feed sesi mapel hari ini (aturan 50%), radar bolos |
| `/api/wali-kelas/sync-presensi` | `POST` | Guru (Wali Kelas) / Admin | Sahkan & simpan 1-klik hasil agregasi mapel ke absensi harian resmi |
| `/api/wali-kelas/summary` | `GET` | Guru (Wali Kelas) / Admin | Ambil indikator ringkasan (kehadiran, alert siswa) |
| `/api/wali-kelas/leger` | `GET` | Guru (Wali Kelas) / Admin / Kepsek | Ambil matriks nilai seluruh mapel kelas tersebut |
| `/api/wali-kelas/catatan` | `GET`, `POST` | Guru (Wali Kelas) | Kelola log pembinaan wali kelas terhadap siswa |
| `/api/wali-kelas/kontak` | `GET` | Guru (Wali Kelas) | Direktori kontak telepon/WA orang tua kelas binaan |

---

## 6. Smart Auto-Feed Presensi (Aturan 50% & Deteksi Bolos)
1. **Zero Double-Input:** Hub Wali Kelas secara otomatis mengagregasikan status kehadiran dari seluruh sesi KBM mapel (`absensi_mapel`) yang berjalan hari itu.
2. **Aturan 50% Jam Kehadiran:**
   * Hadir $\ge 50\%$ jam tercatat $\rightarrow$ Status harian dihitung **Hadir** (dengan catatan jam bolos jika ada sesi Alfa).
   * Hadir $< 50\%$ jam tercatat $\rightarrow$ Status harian dihitung **Alfa / Meninggalkan Sekolah** (atau Sakit/Izin jika mayoritas izin resmi).
3. **Radar Siswa Membolos Realtime:**
   * Mendeteksi otomatis siswa yang hadir di jam tertentu namun Alfa di jam lain (misal: Hadir jam 1-3 B. Indo, Alfa jam 4 MTK, Hadir jam 5-7 IPA).
   * Menampilkan tombol langsung untuk mencatatkan poin pelanggaran kedisiplinan.
4. **1-Klik Konfirmasi Resmi:**
   * Wali kelas dapat mengesahkan rekap harian hanya dengan 1 tombol tanpa perlu input manual dari nol, serta tetap memiliki hak koreksi/override jika ada surat susulan dari orang tua.

---

## 7. Tahapan Eksekusi (Roadmap)

* **Fase 1 (Pondasi Data & Hub Dasar):**
  * Jalankan DDL tabel `wali_kelas` dan trigger sinkronisasi.
  * Tambahkan endpoint `/api/wali-kelas/my-class`.
  * Pasang Hero Card di beranda utama (`/`) dan kerangka halaman `/wali-kelas`.
* **Fase 2 (Pemusatan Presensi & Poin):**
  * Integrasikan form presensi harian kelas dan histori ke dalam tab Hub.
  * Tampilkan radar alert siswa (alfa beruntun & poin kedisiplinan).
* **Fase 3 (Leger Nilai & Cetak Dokumen):**
  * Buat endpoint dan UI matriks Leger Nilai Lintas Mapel.
  * Tambahkan fitur ekspor buku kelas dan leger nilai ke Excel/PDF.
