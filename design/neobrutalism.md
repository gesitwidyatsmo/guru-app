# Neobrutalism Design System

Panduan desain visual berbasis **Neobrutalism** — gaya yang menggabungkan estetika brutalisme digital (tepi tegas, warna berani, kontras tinggi) dengan kenyamanan antarmuka modern.

---

## Filosofi Desain

Neobrutalism adalah reaksi terhadap desain yang terlalu "halus" dan generik. Ia bersikap jujur soal apa itu antarmuka: elemen-elemen yang bisa diklik, form, dan teks. Prinsip utamanya:

- **Kejujuran visual**: Tombol terlihat seperti tombol, bukan gradien mengambang.
- **Kontras adalah raja**: Teks selalu terbaca, batas selalu terlihat.
- **Tebal dan berani**: Bobot font, border, dan shadow tidak malu-malu.
- **Warna yang berbicara**: Setiap warna dipilih karena ia mencolok, bukan karena "aman".

---

## Palet Warna

| Nama                  | Hex       | Penggunaan                            |
| --------------------- | --------- | ------------------------------------- |
| **Cream / Off-White** | `#FFF5F0` | Latar belakang utama, kartu netral    |
| **Warm White**        | `#FFFFFF` | Permukaan kartu, input, modal         |
| **Jet Black**         | `#0D0D0D` | Teks utama, border, shadow            |
| **Signal Orange**     | `#E8451A` | Aksi utama (CTA), highlight penting   |
| **Golden Yellow**     | `#F5C518` | Aksen sekunder, badge, harga          |
| **Teal / Emerald**    | `#00A693` | Status positif, ilustrasi, card aksen |
| **Sky Blue**          | `#2F80ED` | Link, tombol sosial media, info       |
| **Soft Peach**        | `#FFE8DC` | Latar kartu pastel, area on/off state |

### Aturan Penggunaan Warna

- Selalu pasangkan warna latar terang dengan **teks hitam pekat**.
- Latar gelap (hitam) boleh dipadukan teks putih (misalnya tombol CTA).
- Jangan gunakan lebih dari **3 warna mencolok** dalam satu layar.
- Shadow selalu berwarna hitam (`#0D0D0D`), tidak pernah abu-abu transparan.

---

## Tipografi

### Font Stack

```css
/* Display / Judul Besar */
font-family: 'Space Grotesk', 'Syne', 'Plus Jakarta Sans', sans-serif;

/* Body / Konten */
font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;

/* Label / Kode / Data */
font-family: 'Space Mono', 'Geist Mono', monospace;
```

### Skala Tipografi

| Peran            | Size             | Weight  | Karakteristik                 |
| ---------------- | ---------------- | ------- | ----------------------------- |
| Hero / Display   | `2rem–3rem`      | 800–900 | Tebal, letter-spacing negatif |
| Judul Kartu      | `1.25rem–1.5rem` | 700     | Bold, warna hitam atau putih  |
| Subjudul / Label | `0.875rem`       | 600     | Uppercase kadang, semibold    |
| Body             | `1rem`           | 400–500 | Bersih, line-height 1.5       |
| Caption / Meta   | `0.75rem`        | 400     | Abu-abu muted, info sekunder  |

### Aturan Tipografi

- Tidak ada `font-weight` yang lebih ringan dari 400 di area yang penting.
- Judul di atas latar berwarna: gunakan **putih atau hitam** saja.
- Spasi baris (`line-height`) untuk body: minimum `1.5`.

---

## Komponen

### 1. Card (Kartu)

#### Card Netral (Default)

```css
.card {
	background: #ffffff;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	padding: 1.25rem;
	transition:
		transform 0.15s ease,
		box-shadow 0.15s ease;
}

.card:hover {
	transform: translate(-2px, -2px);
	box-shadow: 6px 6px 0px 0px #0d0d0d;
}
```

#### Card Berwarna (Accent)

```css
.card-orange {
	background: #e8451a;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	color: #ffffff;
}

.card-yellow {
	background: #f5c518;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	color: #0d0d0d;
}

.card-teal {
	background: #00a693;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	color: #ffffff;
}

.card-pink {
	background: #ff90e8; /* Pink cerah khas neo-brutalism */
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	color: #0d0d0d;
}

.card-blue {
	background: #3b82f6;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	color: #ffffff;
}

.card-lime {
	background: #a3e635; /* Hijau neon */
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	color: #0d0d0d;
}

.card-purple {
	background: #8b5cf6;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	color: #ffffff;
}
```

#### Card Harga (Pricing Card)

```css
.card-pricing {
	background: #e8451a;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
	padding: 2rem;
	text-align: center;
}

.price-amount {
	font-size: 3rem;
	font-weight: 900;
	color: #ffffff;
	letter-spacing: -0.04em;
}

.price-label {
	font-size: 0.875rem;
	color: rgba(255, 255, 255, 0.85);
}
```

---

### 2. Tombol (Button)

#### Tombol Utama (CTA)

```css
.btn-primary {
	background: #0d0d0d;
	color: #ffffff;
	border: 2px solid #0d0d0d;
	border-radius: 12px;
	padding: 0.75rem 1.5rem;
	font-weight: 700;
	font-size: 0.9375rem;
	box-shadow: 3px 3px 0px 0px rgba(0, 0, 0, 0.5);
	transition: all 0.15s ease;
	cursor: pointer;
}

.btn-primary:hover {
	transform: translate(-1px, -1px);
	box-shadow: 4px 4px 0px 0px rgba(0, 0, 0, 0.5);
}

.btn-primary:active {
	transform: translate(2px, 2px);
	box-shadow: none;
}
```

#### Tombol Outline

```css
.btn-outline {
	background: transparent;
	color: #0d0d0d;
	border: 2px solid #0d0d0d;
	border-radius: 12px;
	padding: 0.75rem 1.5rem;
	font-weight: 600;
	box-shadow: 3px 3px 0px 0px #0d0d0d;
	transition: all 0.15s ease;
}

.btn-outline:hover {
	background: #0d0d0d;
	color: #ffffff;
}
```

#### Tombol Sosial Media

```css
.btn-email {
	background: #0d0d0d;
	color: #fff;
}
.btn-facebook {
	background: #1877f2;
	color: #fff;
}
.btn-twitter {
	background: #1da1f2;
	color: #fff;
}

.btn-social {
	border: 2px solid #0d0d0d;
	border-radius: 12px;
	box-shadow: 3px 3px 0px 0px #0d0d0d;
	padding: 0.75rem 1.5rem;
	font-weight: 600;
	width: 100%;
}
```

#### Tombol Follow / Badge Kecil

```css
.btn-follow {
	background: #f5c518;
	color: #0d0d0d;
	border: 2px solid #0d0d0d;
	border-radius: 8px;
	padding: 0.25rem 0.75rem;
	font-size: 0.8125rem;
	font-weight: 700;
	box-shadow: 2px 2px 0px 0px #0d0d0d;
}
```

---

### 3. Toggle / Switch

```css
.toggle-track {
	width: 48px;
	height: 26px;
	background: #e8e8e8;
	border: 2px solid #0d0d0d;
	border-radius: 999px;
	position: relative;
	cursor: pointer;
	transition: background 0.2s;
}

.toggle-track.active {
	background: #e8451a;
}

.toggle-thumb {
	width: 18px;
	height: 18px;
	background: #ffffff;
	border: 2px solid #0d0d0d;
	border-radius: 50%;
	position: absolute;
	top: 2px;
	left: 2px;
	transition: transform 0.2s;
	box-shadow: 2px 2px 0px 0px #0d0d0d;
}

.toggle-track.active .toggle-thumb {
	transform: translateX(22px);
}
```

---

### 4. Input & Form

```css
.input-field {
	background: #ffffff;
	border: 2px solid #0d0d0d;
	border-radius: 12px;
	padding: 0.75rem 1rem;
	font-size: 1rem;
	font-weight: 500;
	width: 100%;
	transition: box-shadow 0.15s ease;
	box-shadow: 3px 3px 0px 0px #0d0d0d;
}

.input-field:focus {
	outline: none;
	box-shadow: 4px 4px 0px 0px #e8451a;
	border-color: #e8451a;
}

.input-label {
	font-size: 0.8125rem;
	font-weight: 700;
	color: #0d0d0d;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	margin-bottom: 0.5rem;
	display: block;
}

/* Input dengan Ikon */
.neo-input-with-icon {
	padding-left: 2.75rem !important;
}
```

**PANDUAN KRITIKAL (WAJIB DIBACA): Input dengan Ikon**
1. Jika Anda menempatkan ikon (misal pencarian atau ikon mata pelajaran) di dalam input menggunakan `position: absolute`, Anda **WAJIB MUTLAK** menambahkan class `.neo-input-with-icon` ke elemen `<input>` atau `<select>` tersebut.
2. **JANGAN PERNAH** mengandalkan utility class dari Tailwind seperti `pl-10` atau `pl-12` untuk memberi jarak ikon. Class bawaan `.neo-input` memiliki spesifisitas CSS yang tinggi dan akan **mengubah paksa** padding kiri kembali ke awal, sehingga teks akan selalu **bertabrakan** dengan ikon.
3. Satu-satunya cara yang benar adalah menggunakan: `className="neo-input neo-input-with-icon ..."`

Contoh yang benar:
```html
<div class="relative">
  <svg class="absolute left-3 top-3 w-6 h-6 text-black">...</svg>
  <input class="neo-input neo-input-with-icon w-full" placeholder="Cari..." />
</div>
```

**Panduan Input Angka (Number):**
Secara global, panah atas/bawah (spinners) pada `input[type="number"]` telah disembunyikan menggunakan CSS agar desain terlihat bersih dan datar.
Selain itu, untuk mencegah nilai berubah secara tidak sengaja saat pengguna melakukan *scroll* dengan *mouse* di atas input yang sedang aktif, **wajib** menambahkan event `onWheel={(e) => e.target.blur()}` pada elemen input tersebut di React.
Contoh:
```jsx
<input
  type="number"
  className="neo-input"
  onWheel={(e) => e.target.blur()}
/>
```

---

### 5. Avatar & Profile Card

```css
.avatar {
	width: 40px;
	height: 40px;
	border-radius: 50%;
	border: 2px solid #0d0d0d;
	box-shadow: 2px 2px 0px 0px #0d0d0d;
	overflow: hidden;
}

.profile-card {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	background: #ffffff;
	border: 2px solid #0d0d0d;
	border-radius: 16px;
	padding: 0.75rem 1rem;
	box-shadow: 4px 4px 0px 0px #0d0d0d;
}

.profile-name {
	font-weight: 700;
	font-size: 1rem;
	color: #0d0d0d;
}

.profile-sub {
	font-size: 0.8125rem;
	color: #555;
}
```

---

### 6. Info Row / Data Display

```css
.info-row {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	background: #ffffff;
	border: 2px solid #0d0d0d;
	border-radius: 12px;
	padding: 0.75rem 1rem;
	box-shadow: 3px 3px 0px 0px #0d0d0d;
}

.info-label {
	font-size: 0.9375rem;
	font-weight: 700;
	color: #0d0d0d;
}

.info-value {
	font-family: 'Space Mono', monospace;
	font-size: 1.5rem;
	font-weight: 700;
	color: #0d0d0d;
}
```

---

### 7. Message Bubble (Chat)

```css
.message-bubble {
	background: #f5c518;
	border: 2px solid #0d0d0d;
	border-radius: 12px 12px 12px 2px;
	padding: 0.625rem 0.875rem;
	font-weight: 600;
	font-size: 0.875rem;
	color: #0d0d0d;
	box-shadow: 3px 3px 0px 0px #0d0d0d;
	display: inline-block;
	margin-bottom: 0.5rem;
}
```

---

### 8. Ikonografi (Iconography)

**PANDUAN KRITIKAL: Ketebalan Ikon SVG**
Ikon dalam desain Neobrutalism harus memiliki ketebalan (stroke-width) yang tegas namun tidak membengkak (bloated).
- Hindari penggunaan \`strokeWidth="4"\` pada ikon berukuran standar (seperti \`24x24\` atau \`w-6 h-6\`), karena akan menutupi detail dan merusak estetika *pixel-perfect*.
- Gunakan **\`strokeWidth="2.5"\`** atau **\`strokeWidth="3"\`** sebagai standar ideal agar ikon tampak tebal namun tetap terbaca rapi.
- Pastikan SVG memiliki atribut \`fill="none"\` dan \`stroke="currentColor"\` agar mudah dikontrol pewarnaannya.

---
## Shadow System

Semua bayangan di sistem ini bersifat **hard / offset shadow** — tidak ada blur.

```css
--shadow-xs: 2px 2px 0px 0px #0d0d0d;
--shadow-sm: 3px 3px 0px 0px #0d0d0d;
--shadow-md: 4px 4px 0px 0px #0d0d0d;
--shadow-lg: 6px 6px 0px 0px #0d0d0d;
```

---

## Border Radius System

| Token           | Value   | Digunakan pada          |
| --------------- | ------- | ----------------------- |
| `--radius-sm`   | `8px`   | Badge, tag kecil        |
| `--radius-md`   | `12px`  | Tombol, input, row data |
| `--radius-lg`   | `16px`  | Kartu, modal            |
| `--radius-full` | `999px` | Toggle, avatar, chip    |

**Aturan**: Satu layar menggunakan **satu** ukuran radius secara konsisten.

---

## Motion & Animasi

```css
--duration-fast: 0.1s;
--duration-normal: 0.15s;
--ease-neo: cubic-bezier(0.4, 0, 0.2, 1);

.interactive:hover {
	transform: translate(-2px, -2px);
	box-shadow: var(--shadow-lg);
}

.interactive:active {
	transform: translate(2px, 2px);
	box-shadow: none;
}
```

---

## Tata Letak (Layout)

```css
.grid-cards {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 1.25rem;
}

.page-container {
	max-width: 1200px;
	margin: 0 auto;
	padding: 1.5rem;
}

--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-8: 2rem;
--space-10: 2.5rem;
```

---

## Checklist Implementasi

- [ ] Border `2px solid #0D0D0D` pada semua elemen interaktif
- [ ] Hard shadow (offset, tanpa blur) pada kartu dan tombol
- [ ] Font weight **minimum 600** untuk teks penting
- [ ] Warna latar dari palet yang telah ditentukan (bukan gradien)
- [ ] Hover state: `translate(-2px, -2px)` + shadow lebih besar
- [ ] Active state: `translate(2px, 2px)` + shadow hilang
- [ ] Teks selalu hitam atau putih di atas warna aksen
- [ ] Tidak ada `blur()` atau `opacity` rendah pada shadow
- [ ] Tidak ada glassmorphism atau efek frosted glass
- [ ] Radius konsisten (pilih satu ukuran per konteks)

---

## Referensi Komponen dari Visual

- **Social post card** — avatar + nama + konten + aksi (like, share)
- **Event card** — latar berwarna + judul bold + tanggal
- **Pricing card** — harga besar + daftar fitur + tombol CTA
- **Weather row** — ikon + lokasi + suhu (data display)
- **Profile list item** — avatar + nama + tombol follow
- **Toggle on/off** — track berwarna + thumb bergerak
- **Login form** — judul + tombol sosial media bergaya neo
- **Feature card** — judul + deskripsi + tombol konfirmasi
- **Message bubble** — chat dengan bentuk asimetris

---

_Dokumen ini adalah referensi desain hidup. Perbarui saat menambahkan komponen baru ke sistem._
