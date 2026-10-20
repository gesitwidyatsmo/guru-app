# Aturan Kode Guru App (Antigravity & AI Agent Rules)

Dokumen ini berisi aturan wajib bagi AI Agent (Antigravity) saat membaca, menulis, merefaktor, atau mengaudit kode di repositori ini.

---

## 1. Aturan Normalisasi Status Presensi / Kehadiran Siswa

### Aturan Utama:
Seluruh variasi penulisan status ketidakhadiran berikut:
- `"Alpa"` (ejaan umum dengan huruf **P** yang tersimpan di tabel database Supabase)
- `"Alfa"` (ejaan bahasa Indonesia baku dengan huruf **F**)
- `"ALPHA"` (ejaan tombol antarmuka UI dengan huruf **PH**)
- `"A"` atau `"a"` (singkatan huruf status)

**WAJIB SECARA OTOMATIS DIKENALI SERAGAM SEBAGAI STATUS "Alfa"** di seluruh bagian aplikasi (API route, query database, logika audit kesiswaan, agregasi wali kelas, hingga komponen UI frontend).

### Standar Fungsi Helper:
Gunakan fungsi normalisasi seragam berikut setiap kali memeriksa atau memfilter status absensi:

```javascript
export const normStatus = (val) => {
	const s = String(val || '').trim().toLowerCase();
	if (s === 'hadir' || s === 'h') return 'hadir';
	if (s === 'sakit' || s === 's') return 'sakit';
	if (s === 'izin' || s === 'i') return 'izin';
	if (s === 'alfa' || s === 'alpa' || s === 'alpha' || s === 'a') return 'alfa';
	return s;
};
```

### Standar Query Database (Supabase / PostgreSQL):
Ketika melakukan filter data alfa pada tabel database (seperti `absensi_mapel_siswa` atau `absensi_harian_siswa`), jangan hanya memfilter `alfa%`, tetapi wajib mencakup seluruh variasi ejaan:

```javascript
// Query filter yang benar:
.or('status.ilike.alfa%,status.ilike.alpa%,status.ilike.alpha%,status.eq.A,status.eq.a')
```

---

## 2. Aturan SQL Migration Supabase: Wajib GRANT Permissions (Mulai 30 Oktober)

### Aturan Utama:
Supabase menghentikan pemberian hak akses Data API otomatis (`default privileges`) untuk tabel baru di schema `public`. Oleh karena itu, **setiap pembuatan tabel baru melalui file migrasi SQL WAJIB menyertakan perintah `GRANT` eksplisit** setelah deklarasi tabel dan RLS.

### Standar Sintaks Migration:
Setiap file migrasi yang membuat tabel baru (`CREATE TABLE ...`) wajib menyertakan blok berikut:

```sql
-- Berikan izin akses Data API (PostgREST / Supabase JS)
GRANT SELECT ON public.nama_tabel TO anon; -- (Hanya jika tabel boleh dibaca guest/tanpa login)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nama_tabel TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nama_tabel TO service_role;
```
*(Catatan: RLS tetap wajib diaktifkan (`ENABLE ROW LEVEL SECURITY`) untuk mengontrol baris data mana yang boleh dibaca/ditulis oleh masing-masing role).*
