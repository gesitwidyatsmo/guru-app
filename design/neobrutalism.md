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

| Nama | Hex | Penggunaan |
|---|---|---|
| **Cream / Off-White** | `#FFF5F0` | Latar belakang utama, kartu netral |
| **Warm White** | `#FFFFFF` | Permukaan kartu, input, modal |
| **Jet Black** | `#0D0D0D` | Teks utama, border, shadow |
| **Signal Orange** | `#E8451A` | Aksi utama (CTA), highlight penting |
| **Golden Yellow** | `#F5C518` | Aksen sekunder, badge, harga |
| **Teal / Emerald** | `#00A693` | Status positif, ilustrasi, card aksen |
| **Sky Blue** | `#2F80ED` | Link, tombol sosial media, info |
| **Soft Peach** | `#FFE8DC` | Latar kartu pastel, area on/off state |

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

| Peran | Size | Weight | Karakteristik |
|---|---|---|---|
| Hero / Display | `2rem–3rem` | 800–900 | Tebal, letter-spacing negatif |
| Judul Kartu | `1.25rem–1.5rem` | 700 | Bold, warna hitam atau putih |
| Subjudul / Label | `0.875rem` | 600 | Uppercase kadang, semibold |
| Body | `1rem` | 400–500 | Bersih, line-height 1.5 |
| Caption / Meta | `0.75rem` | 400 | Abu-abu muted, info sekunder |

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
  background: #FFFFFF;
  border: 2px solid #0D0D0D;
  border-radius: 16px;
  box-shadow: 4px 4px 0px 0px #0D0D0D;
  padding: 1.25rem;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0px 0px #0D0D0D;
}
```

#### Card Berwarna (Accent)
```css
.card-orange {
  background: #E8451A;
  border: 2px solid #0D0D0D;
  border-radius: 16px;
  box-shadow: 4px 4px 0px 0px #0D0D0D;
  color: #FFFFFF;
}

.card-yellow {
  background: #F5C518;
  border: 2px solid #0D0D0D;
  border-radius: 16px;
  box-shadow: 4px 4px 0px 0px #0D0D0D;
  color: #0D0D0D;
}

.card-teal {
  background: #00A693;
  border: 2px solid #0D0D0D;
  border-radius: 16px;
  box-shadow: 4px 4px 0px 0px #0D0D0D;
  color: #FFFFFF;
}
```

#### Card Harga (Pricing Card)
```css
.card-pricing {
  background: #E8451A;
  border: 2px solid #0D0D0D;
  border-radius: 16px;
  box-shadow: 4px 4px 0px 0px #0D0D0D;
  padding: 2rem;
  text-align: center;
}

.price-amount {
  font-size: 3rem;
  font-weight: 900;
  color: #FFFFFF;
  letter-spacing: -0.04em;
}

.price-label {
  font-size: 0.875rem;
  color: rgba(255,255,255,0.85);
}
```

---

### 2. Tombol (Button)

#### Tombol Utama (CTA)
```css
.btn-primary {
  background: #0D0D0D;
  color: #FFFFFF;
  border: 2px solid #0D0D0D;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  font-weight: 700;
  font-size: 0.9375rem;
  box-shadow: 3px 3px 0px 0px rgba(0,0,0,0.5);
  transition: all 0.15s ease;
  cursor: pointer;
}

.btn-primary:hover {
  transform: translate(-1px, -1px);
  box-shadow: 4px 4px 0px 0px rgba(0,0,0,0.5);
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
  color: #0D0D0D;
  border: 2px solid #0D0D0D;
  border-radius: 12px;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  box-shadow: 3px 3px 0px 0px #0D0D0D;
  transition: all 0.15s ease;
}

.btn-outline:hover {
  background: #0D0D0D;
  color: #FFFFFF;
}
```

#### Tombol Sosial Media
```css
.btn-email    { background: #0D0D0D; color: #FFF; }
.btn-facebook { background: #1877F2; color: #FFF; }
.btn-twitter  { background: #1DA1F2; color: #FFF; }

.btn-social {
  border: 2px solid #0D0D0D;
  border-radius: 12px;
  box-shadow: 3px 3px 0px 0px #0D0D0D;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  width: 100%;
}
```

#### Tombol Follow / Badge Kecil
```css
.btn-follow {
  background: #F5C518;
  color: #0D0D0D;
  border: 2px solid #0D0D0D;
  border-radius: 8px;
  padding: 0.25rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 700;
  box-shadow: 2px 2px 0px 0px #0D0D0D;
}
```

---

### 3. Toggle / Switch
```css
.toggle-track {
  width: 48px;
  height: 26px;
  background: #E8E8E8;
  border: 2px solid #0D0D0D;
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
}

.toggle-track.active {
  background: #E8451A;
}

.toggle-thumb {
  width: 18px;
  height: 18px;
  background: #FFFFFF;
  border: 2px solid #0D0D0D;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform 0.2s;
  box-shadow: 2px 2px 0px 0px #0D0D0D;
}

.toggle-track.active .toggle-thumb {
  transform: translateX(22px);
}
```

---

### 4. Input & Form
```css
.input-field {
  background: #FFFFFF;
  border: 2px solid #0D0D0D;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-weight: 500;
  width: 100%;
  transition: box-shadow 0.15s ease;
  box-shadow: 3px 3px 0px 0px #0D0D0D;
}

.input-field:focus {
  outline: none;
  box-shadow: 4px 4px 0px 0px #E8451A;
  border-color: #E8451A;
}

.input-label {
  font-size: 0.8125rem;
  font-weight: 700;
  color: #0D0D0D;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.5rem;
  display: block;
}
```

---

### 5. Avatar & Profile Card
```css
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid #0D0D0D;
  box-shadow: 2px 2px 0px 0px #0D0D0D;
  overflow: hidden;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #FFFFFF;
  border: 2px solid #0D0D0D;
  border-radius: 16px;
  padding: 0.75rem 1rem;
  box-shadow: 4px 4px 0px 0px #0D0D0D;
}

.profile-name {
  font-weight: 700;
  font-size: 1rem;
  color: #0D0D0D;
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
  background: #FFFFFF;
  border: 2px solid #0D0D0D;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  box-shadow: 3px 3px 0px 0px #0D0D0D;
}

.info-label {
  font-size: 0.9375rem;
  font-weight: 700;
  color: #0D0D0D;
}

.info-value {
  font-family: 'Space Mono', monospace;
  font-size: 1.5rem;
  font-weight: 700;
  color: #0D0D0D;
}
```

---

### 7. Message Bubble (Chat)
```css
.message-bubble {
  background: #F5C518;
  border: 2px solid #0D0D0D;
  border-radius: 12px 12px 12px 2px;
  padding: 0.625rem 0.875rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: #0D0D0D;
  box-shadow: 3px 3px 0px 0px #0D0D0D;
  display: inline-block;
  margin-bottom: 0.5rem;
}
```

---

## Shadow System

Semua bayangan di sistem ini bersifat **hard / offset shadow** — tidak ada blur.

```css
--shadow-xs: 2px 2px 0px 0px #0D0D0D;
--shadow-sm: 3px 3px 0px 0px #0D0D0D;
--shadow-md: 4px 4px 0px 0px #0D0D0D;
--shadow-lg: 6px 6px 0px 0px #0D0D0D;
```

---

## Border Radius System

| Token | Value | Digunakan pada |
|---|---|---|
| `--radius-sm` | `8px` | Badge, tag kecil |
| `--radius-md` | `12px` | Tombol, input, row data |
| `--radius-lg` | `16px` | Kartu, modal |
| `--radius-full` | `999px` | Toggle, avatar, chip |

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

--space-1: 0.25rem;  --space-2: 0.5rem;
--space-3: 0.75rem;  --space-4: 1rem;
--space-5: 1.25rem;  --space-6: 1.5rem;
--space-8: 2rem;     --space-10: 2.5rem;
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

*Dokumen ini adalah referensi desain hidup. Perbarui saat menambahkan komponen baru ke sistem.*
