// 100 Comprehensive Chemistry Questions for Chemistry of Champion
// Covering: Stoikiometri, Struktur Atom, Sistem Periodik, Ikatan Kimia, Termokimia,
// Laju Reaksi, Kesetimbangan, Asam-Basa, Titrasi & Buffer, Hidrolisis Garam, Ksp,
// Koligatif Larutan, Redoks & Elektrokimia, Kimia Unsur, Kimia Organik & Polimer.

export const defaultQuestions = [
	{
		id: 1,
		topic: "Struktur Atom",
		question: "Partikel subatom yang bermuatan positif dan berada di dalam inti atom adalah...",
		options: ["Elektron", "Proton", "Neutron", "Positron", "Foton"],
		answer: "Proton",
		explanation: "Proton adalah partikel bermuatan positif (+1) yang terletak di dalam inti atom bersama neutron.",
		points: 10
	},
	{
		id: 2,
		topic: "Tabel Periodik",
		question: "Unsur dengan konfigurasi elektron 1s² 2s² 2p⁶ 3s² 3p⁴ terletak pada golongan dan periode...",
		options: ["Golongan VIA, Periode 3", "Golongan IVA, Periode 3", "Golongan IIA, Periode 4", "Golongan VIIIA, Periode 2", "Golongan VA, Periode 3"],
		answer: "Golongan VIA, Periode 3",
		explanation: "Kulit terbesar = 3 (Periode 3), elektron valensi pada kulit ke-3 adalah 2 + 4 = 6 (Golongan VIA).",
		points: 10
	},
	{
		id: 3,
		topic: "Ikatan Kimia",
		question: "Ikatan yang terbentuk karena adanya serah terima elektron antara atom logam dan nonlogam disebut...",
		options: ["Ikatan Kovalen Polar", "Ikatan Ionik", "Ikatan Logam", "Ikatan Hidrogen", "Ikatan Kovalen Koordinasi"],
		answer: "Ikatan Ionik",
		explanation: "Ikatan ion terbentuk melalui gaya elektrostatik akibat perpindahan (serah terima) elektron dari unsur elektropositif ke elektronegatif.",
		points: 10
	},
	{
		id: 4,
		topic: "Stoikiometri",
		question: "Berapa massa molar (Mr) dari asam sulfat (H₂SO₄)? (Ar H=1, S=32, O=16)",
		options: ["98 g/mol", "96 g/mol", "100 g/mol", "64 g/mol", "80 g/mol"],
		answer: "98 g/mol",
		explanation: "Mr H₂SO₄ = (2×1) + (1×32) + (4×16) = 2 + 32 + 64 = 98 g/mol.",
		points: 10
	},
	{
		id: 5,
		topic: "Stoikiometri Gas",
		question: "Pada kondisi STP (0°C, 1 atm), volume dari 0,5 mol gas oksigen (O₂) adalah...",
		options: ["11,2 Liter", "22,4 Liter", "5,6 Liter", "44,8 Liter", "2,24 Liter"],
		answer: "11,2 Liter",
		explanation: "V = n × 22,4 L = 0,5 × 22,4 = 11,2 Liter.",
		points: 10
	},
	{
		id: 6,
		topic: "Termokimia",
		question: "Reaksi yang melepaskan kalor dari sistem ke lingkungan dan memiliki nilai ΔH bernilai negatif disebut reaksi...",
		options: ["Endoterm", "Eksoterm", "Isoterm", "Sublimasi", "Adiabatik"],
		answer: "Eksoterm",
		explanation: "Reaksi eksoterm membebaskan kalor sehingga entalpi produk lebih kecil dari reaktan (ΔH < 0).",
		points: 10
	},
	{
		id: 7,
		topic: "Laju Reaksi",
		question: "Faktor manakah yang TIDAK mempercepat laju reaksi kimia?",
		options: ["Menaikkan suhu", "Menambahkan katalis", "Memperluas permukaan bidang sentuh", "Menaikkan konsentrasi reaktan", "Menurunkan konsentrasi reaktan"],
		answer: "Menurunkan konsentrasi reaktan",
		explanation: "Menurunkan konsentrasi reaktan mengurangi frekuensi tumbukan efektif sehingga memperlambat laju reaksi.",
		points: 10
	},
	{
		id: 8,
		topic: "Kesetimbangan Kimia",
		question: "Berdasarkan Asas Le Chatelier, jika pada reaksi eksoterm suhu dinaikkan, maka arah kesetimbangan akan bergeser ke arah...",
		options: ["Kiri (Reaktan/Endoterm)", "Kanan (Produk)", "Tidak bergeser", "Atas", "Bawah"],
		answer: "Kiri (Reaktan/Endoterm)",
		explanation: "Kenaikan suhu menggeser kesetimbangan ke arah reaksi yang menyerap kalor (endoterm / kiri).",
		points: 10
	},
	{
		id: 9,
		topic: "Asam Basa",
		question: "Berapakah nilai pH dari larutan HCl dengan konsentrasi 0,001 M (10⁻³ M)?",
		options: ["1", "2", "3", "4", "11"],
		answer: "3",
		explanation: "HCl asam kuat valensi 1: [H⁺] = 10⁻³ M → pH = -log(10⁻³) = 3.",
		points: 10
	},
	{
		id: 10,
		topic: "Asam Basa",
		question: "Menurut teori Bronsted-Lowry, asam didefinisikan sebagai spesi yang bertindak sebagai...",
		options: ["Donor Proton (H⁺)", "Akseptor Proton (H⁺)", "Donor Pasangan Elektron", "Akseptor Pasangan Elektron", "Penghasil ion OH⁻"],
		answer: "Donor Proton (H⁺)",
		explanation: "Asam Bronsted-Lowry adalah donor proton (H⁺), sedangkan basa adalah akseptor proton.",
		points: 10
	},
	{
		id: 11,
		topic: "Larutan Penyangga (Buffer)",
		question: "Campuran manakah berikut ini yang dapat membentuk larutan penyangga asam?",
		options: ["CH₃COOH + CH₃COONa", "HCl + NaCl", "NaOH + NaCl", "NH₄OH + HCl berlebih", "H₂SO₄ + Na₂SO₄"],
		answer: "CH₃COOH + CH₃COONa",
		explanation: "Buffer asam terdiri dari asam lemah (CH₃COOH) dan basa konjugasinya (CH₃COO⁻ dari CH₃COONa).",
		points: 10
	},
	{
		id: 12,
		topic: "Hidrolisis Garam",
		question: "Garam NH₄Cl dalam air akan terhidrolisis sebagian menghasilkan larutan yang bersifat...",
		options: ["Asam (pH < 7)", "Basa (pH > 7)", "Netral (pH = 7)", "Amfoter", "Non-elektrolit"],
		answer: "Asam (pH < 7)",
		explanation: "NH₄Cl terbentuk dari basa lemah (NH₄OH) dan asam kuat (HCl). Kation NH₄⁺ terhidrolisis menghasilkan ion H₃O⁺ sehingga pH < 7.",
		points: 10
	},
	{
		id: 13,
		topic: "Ksp & Kelarutan",
		question: "Jika nilai Ksp AgCl adalah 1 × 10⁻¹⁰, berapakah kelarutan (s) AgCl dalam air murni?",
		options: ["1 × 10⁻⁵ M", "1 × 10⁻¹⁰ M", "1 × 10⁻²⁰ M", "2 × 10⁻⁵ M", "1 × 10⁻² M"],
		answer: "1 × 10⁻⁵ M",
		explanation: "AgCl ⇌ Ag⁺ + Cl⁻ → Ksp = s² → s = √(10⁻¹⁰) = 1 × 10⁻⁵ M.",
		points: 10
	},
	{
		id: 14,
		topic: "Sifat Koligatif",
		question: "Penambahan zat terlarut non-volatil ke dalam pelarut murni akan menyebabkan...",
		options: ["Penurunan titik beku dan kenaikan titik didih", "Kenaikan titik beku dan penurunan titik didih", "Penurunan tekanan osmotik", "Kenaikan tekanan uap jenuh", "Tidak ada perubahan suhu"],
		answer: "Penurunan titik beku dan kenaikan titik didih",
		explanation: "Zat terlarut non-volatil menyebabkan ΔTb (kenaikan titik didih) dan ΔTf (penurunan titik beku).",
		points: 10
	},
	{
		id: 15,
		topic: "Redoks",
		question: "Berapakah bilangan oksidasi unsur Mangan (Mn) dalam senyawa Kalium Permanganat (KMnO₄)?",
		options: ["+7", "+6", "+4", "+2", "-1"],
		answer: "+7",
		explanation: "Biloks K = +1, O = -2 (4×-2 = -8). Total netral: (+1) + Mn + (-8) = 0 → Mn = +7.",
		points: 10
	},
	{
		id: 16,
		topic: "Sel Volta",
		question: "Pada sel Volta elektrokimia, kutub anoda merupakan kutub ... dan tempat terjadinya reaksi ...",
		options: ["Negatif, Oksidasi", "Positif, Reduksi", "Positif, Oksidasi", "Negatif, Reduksi", "Netral, Pengendapan"],
		answer: "Negatif, Oksidasi",
		explanation: "Jembatan keledai KRAO / PAN (Positif Anoda di Elektrolisis, Negatif Anoda di Volta). Anoda selalu tempat oksidasi.",
		points: 10
	},
	{
		id: 17,
		topic: "Sel Elektrolisis",
		question: "Pada elektrolisis larutan NaCl dengan elektroda karbon (C), gas yang dihasilkan di anoda adalah...",
		options: ["Gas Klorin (Cl₂)", "Gas Hidrogen (H₂)", "Gas Oksigen (O₂)", "Gas Natrium", "Gas Karbon Dioksida"],
		answer: "Gas Klorin (Cl₂)",
		explanation: "Ion klorida (Cl⁻) dioksidasi di anoda menghasilkan gas Cl₂ (2Cl⁻ → Cl₂ + 2e⁻).",
		points: 10
	},
	{
		id: 18,
		topic: "Kimia Organik",
		question: "Rumus umum untuk senyawa hidrokarbon golongan Alkana adalah...",
		options: ["CnH2n+2", "CnH2n", "CnH2n-2", "CnH2n+1OH", "CnH2nO"],
		answer: "CnH2n+2",
		explanation: "Alkana merupakan hidrokarbon jenuh dengan ikatan kovalen tunggal dan rumus umum CnH2n+2.",
		points: 10
	},
	{
		id: 19,
		topic: "Gugus Fungsi",
		question: "Gugus fungsi -OH adalah ciri khas dari golongan senyawa karbon...",
		options: ["Alkohol (Alkanol)", "Eter (Alkoksi Alkana)", "Aldehid (Alkanal)", "Asam Karboksilat", "Ester"],
		answer: "Alkohol (Alkanol)",
		explanation: "Gugus hidroksil (-OH) adalah gugus fungsi senyawa alkohol (alkanol).",
		points: 10
	},
	{
		id: 20,
		topic: "Kimia Polimer",
		question: "Polimer alam berikut yang tersusun dari monomer glukosa dengan ikatan glikosida adalah...",
		options: ["Amilum / Selulosa", "Protein", "Polietilena", "Karet Alam", "Teflon"],
		answer: "Amilum / Selulosa",
		explanation: "Amilum dan selulosa adalah polisakarida alami yang tersusun dari unit-unit glukosa.",
		points: 10
	},
	{
		id: 21,
		topic: "Struktur Atom",
		question: "Nomor atom suatu unsur menyatakan jumlah ... dalam inti atom netral.",
		options: ["Proton", "Neutron", "Nukleon", "Positron", "Massa"],
		answer: "Proton",
		explanation: "Nomor atom (Z) menyatakan jumlah proton dalam inti atom. Pada atom netral, jumlah elektron sama dengan nomor atom.",
		points: 10
	},
	{
		id: 22,
		topic: "Ikatan Kimia",
		question: "Molekul air (H₂O) memiliki bentuk geometri molekul...",
		options: ["Bengkok / Huruf V", "Linear", "Tetrahedral", "Trigonal Piramida", "Oktahedral"],
		answer: "Bengkok / Huruf V",
		explanation: "H₂O memiliki tipe molekul AX₂E₂ dengan 2 PEI dan 2 PEB sehingga berbentuk bengkok / huruf V (sudut ~104,5°).",
		points: 10
	},
	{
		id: 23,
		topic: "Ikatan Antar Molekul",
		question: "Ikatan antarmolekul yang paling kuat di antara molekul HF, H₂O, dan NH₃ disebut...",
		options: ["Ikatan Hidrogen", "Gaya London", "Gaya Dipol-Dipol", "Gaya Van der Waals", "Ikatan Kovalen"],
		answer: "Ikatan Hidrogen",
		explanation: "Ikatan hidrogen terjadi antara atom H dengan atom yang sangat elektronegatif (F, O, N).",
		points: 10
	},
	{
		id: 24,
		topic: "Stoikiometri",
		question: "Berapa jumlah partikel atom yang terdapat dalam 1 mol zat menurut bilangan Avogadro?",
		options: ["6,02 × 10²³ partikel", "3,01 × 10²³ partikel", "1,20 × 10²⁴ partikel", "6,02 × 10²² partikel", "9,8 × 10²³ partikel"],
		answer: "6,02 × 10²³ partikel",
		explanation: "Bilangan Avogadro (L) adalah konstanta dasar kimia senilai 6,022 × 10²³ partikel/mol.",
		points: 10
	},
	{
		id: 25,
		topic: "Kimia Larutan",
		question: "Senyawa yang dalam larutan air terionisasi sempurna dan menghantarkan listrik kuat disebut...",
		options: ["Elektrolit Kuat", "Elektrolit Lemah", "Non-Elektrolit", "Larutan Koloid", "Suspensi"],
		answer: "Elektrolit Kuat",
		explanation: "Elektrolit kuat memiliki derajat ionisasi α = 1 (contoh: HCl, NaOH, NaCl).",
		points: 10
	},
	{
		id: 26,
		topic: "Hukum Gas Ideal",
		question: "Persamaan gas ideal dirumuskan sebagai PV = nRT. Nilai R dalam satuan L.atm/(mol.K) adalah...",
		options: ["0,082", "8,314", "1,987", "6,02", "22,4"],
		answer: "0,082",
		explanation: "Tetapan gas ideal R = 0,08206 L·atm/(mol·K) atau 8,314 J/(mol·K).",
		points: 10
	},
	{
		id: 27,
		topic: "Termokimia",
		question: "Hukum yang menyatakan bahwa perubahan entalpi reaksi hanya bergantung pada keadaan awal dan akhir adalah...",
		options: ["Hukum Hess", "Hukum Lavoisier", "Hukum Proust", "Hukum Dalton", "Hukum Gay-Lussac"],
		answer: "Hukum Hess",
		explanation: "Hukum Hess menyatakan ΔH reaksi total adalah penjumlahan ΔH dari setiap tahap reaksi.",
		points: 10
	},
	{
		id: 28,
		topic: "Laju Reaksi",
		question: "Zat yang dapat mempercepat laju reaksi dengan menurunkan energi aktivasi tanpa mengalami perubahan permanen adalah...",
		options: ["Katalis", "Inhibitor", "Reaktan", "Indikator", "Pelarut"],
		answer: "Katalis",
		explanation: "Katalis menurunkan energi aktivasi (Ea) reaksi sehingga partikel lebih mudah mencapai kompleks teraktivasi.",
		points: 10
	},
	{
		id: 29,
		topic: "Kesetimbangan Kimia",
		question: "Hubungan antara Kc dan Kp pada reaksi gas dinyatakan oleh rumus...",
		options: ["Kp = Kc (RT)^Δn", "Kc = Kp (RT)^Δn", "Kp = Kc / RT", "Kp = Kc × P", "Kp = Kc + RT"],
		answer: "Kp = Kc (RT)^Δn",
		explanation: "Kp = Kc(RT)^Δn di mana Δn = koefisien produk gas - koefisien reaktan gas.",
		points: 10
	},
	{
		id: 30,
		topic: "Asam Basa",
		question: "Suatu larutan memiliki konsentrasi ion OH⁻ = 10⁻⁴ M. Berapakah pH larutan tersebut?",
		options: ["10", "4", "7", "14", "8"],
		answer: "10",
		explanation: "pOH = -log[OH⁻] = 4 → pH = 14 - pOH = 14 - 4 = 10.",
		points: 10
	},
	{
		id: 31,
		topic: "Titrasi Asam Basa",
		question: "Indikator fenolftalein (PP) dalam suasana basa akan memberikan warna...",
		options: ["Merah Muda / Pink", "Kuning", "Biru", "Bening / Tak Berwarna", "Hijau"],
		answer: "Merah Muda / Pink",
		explanation: "PP tidak berwarna pada pH < 8,3 dan berwarna merah muda/magenta pada pH > 8,3 (basa).",
		points: 10
	},
	{
		id: 32,
		topic: "Hidrolisis Garam",
		question: "Garam berikut ini yang TIDAK mengalami hidrolisis sama sekali dalam air adalah...",
		options: ["NaCl", "CH₃COONa", "NH₄Cl", "Al₂(SO₄)₃", "Na₂CO₃"],
		answer: "NaCl",
		explanation: "NaCl terbentuk dari kation basa kuat (Na⁺) dan anion asam kuat (Cl⁻) yang tidak bereaksi dengan air (pH netral = 7).",
		points: 10
	},
	{
		id: 33,
		topic: "Sifat Koligatif",
		question: "Tekanan osmotik larutan glukosa 0,1 M pada suhu 27°C (300 K) dihitung menggunakan rumus π = M R T. Berapakah nilainya? (R=0,082)",
		options: ["2,46 atm", "24,6 atm", "0,246 atm", "1,23 atm", "4,92 atm"],
		answer: "2,46 atm",
		explanation: "π = M × R × T = 0,1 × 0,082 × 300 = 2,46 atm.",
		points: 10
	},
	{
		id: 34,
		topic: "Redoks",
		question: "Reaksi di mana suatu unsur mengalami reaksi reduksi dan oksidasi sekaligus disebut reaksi...",
		options: ["Autoredoks (Disproporsionasi)", "Substitusi", "Adisi", "Eliminasi", "Netralisasi"],
		answer: "Autoredoks (Disproporsionasi)",
		explanation: "Reaksi disproporsionasi adalah reaksi redoks di mana spesi yang sama bertindak sebagai reduktor dan oksidator.",
		points: 10
	},
	{
		id: 35,
		topic: "Deret Volta",
		question: "Berdasarkan deret Volta, logam yang paling mudah mengalami oksidasi (reduktor terkuat) adalah...",
		options: ["Litium (Li)", "Emas (Au)", "Tembaga (Cu)", "Perak (Ag)", "Besi (Fe)"],
		answer: "Litium (Li)",
		explanation: "Dalam deret Volta (Li K Ba Ca Na Mg Al Mn Zn Cr Fe ... Au), Li terletak paling kiri dengan potensial reduksi paling negatif.",
		points: 10
	},
	{
		id: 36,
		topic: "Korosi",
		question: "Metode perlindungan katodik pada pipa besi bawah tanah sering menggunakan batang logam tumbal berupa...",
		options: ["Magnesium (Mg) / Seng (Zn)", "Tembaga (Cu)", "Emas (Au)", "Perak (Ag)", "Platina (Pt)"],
		answer: "Magnesium (Mg) / Seng (Zn)",
		explanation: "Mg dan Zn memiliki E° lebih negatif daripada besi (Fe), sehingga akan teroksidasi lebih dahulu melindungi besi.",
		points: 10
	},
	{
		id: 37,
		topic: "Senyawa Karbon",
		question: "Senyawa dengan rumus molekul C₂H₆O yang digunakan sebagai antiseptik dan pelarut adalah...",
		options: ["Etanol", "Metanol", "Aseton", "Formalin", "Asam Asetat"],
		answer: "Etanol",
		explanation: "Etanol (C₂H₅OH) berisomer fungsi dengan dimetil eter dan banyak digunakan sebagai antiseptik.",
		points: 10
	},
	{
		id: 38,
		topic: "Isomeri",
		question: "Senyawa etanol (CH₃-CH₂-OH) dan dimetil eter (CH₃-O-CH₃) merupakan pasangan...",
		options: ["Isomer Gugus Fungsi", "Isomer Posisi", "Isomer Rangka", "Isomer Geometri", "Isomer Optik"],
		answer: "Isomer Gugus Fungsi",
		explanation: "Keduanya memiliki rumus molekul sama (C₂H₆O) tetapi gugus fungsinya berbeda (alkohol vs eter).",
		points: 10
	},
	{
		id: 39,
		topic: "Kimia Unsur",
		question: "Gas mulia yang paling banyak terdapat di atmosfer bumi adalah...",
		options: ["Argon (Ar)", "Helium (He)", "Neon (Ne)", "Kripton (Kr)", "Xenon (Xe)"],
		answer: "Argon (Ar)",
		explanation: "Argon menempati sekitar 0,93% volume atmosfer bumi, menjadikannya gas mulia paling melimpah di udara.",
		points: 10
	},
	{
		id: 40,
		topic: "Kimia Unsur",
		question: "Sifat khas unsur-unsur transisi periode 4 adalah memiliki senyawa yang...",
		options: ["Berwarna dan bersifat paramagnetik", "Selalu tidak berwarna", "Bersifat nonlogam", "Tidak dapat membentuk ion kompleks", "Hanya memiliki satu biloks"],
		answer: "Berwarna dan bersifat paramagnetik",
		explanation: "Unsur transisi memiliki elektron tak berpasangan pada subkulit 3d sehingga senyawa umumnya berwarna dan paramagnetik.",
		points: 10
	},
	{
		id: 41,
		topic: "Kimia Lingkungan",
		question: "Gas rumah kaca yang paling utama dihasilkan dari pembakaran bahan bakar fosil adalah...",
		options: ["Karbon Dioksida (CO₂)", "Oksigen (O₂)", "Nitrogen (N₂)", "Hidrogen (H₂)", "Helium (He)"],
		answer: "Karbon Dioksida (CO₂)",
		explanation: "CO₂ adalah gas rumah kaca utama penyebab pemanasan global akibat aktivitas industri dan transportasi.",
		points: 10
	},
	{
		id: 42,
		topic: "Koloid",
		question: "Hamburan berkas cahaya oleh partikel-partikel koloid disebut efek...",
		options: ["Efek Tyndall", "Gerak Brown", "Elektroforesis", "Koagulasi", "Dialisis"],
		answer: "Efek Tyndall",
		explanation: "Efek Tyndall adalah fenomena penghamburan cahaya oleh partikel koloid (contoh: sorot lampu mobil di kabut).",
		points: 10
	},
	{
		id: 43,
		topic: "Koloid",
		question: "Sistem koloid dari zat cair yang terdispersi dalam medium pendispersi gas disebut...",
		options: ["Aerosol Cair (Kabut/Awan)", "Emulsi", "Sol Padat", "Busa", "Gel"],
		answer: "Aerosol Cair (Kabut/Awan)",
		explanation: "Aerosol cair adalah fase terdispersi cair dalam medium gas, contohnya kabut, awan, dan hair spray.",
		points: 10
	},
	{
		id: 44,
		topic: "Konsep Mol",
		question: "Berapakah jumlah mol dari 18 gram air (H₂O)? (Ar H=1, O=16)",
		options: ["1 mol", "0,5 mol", "2 mol", "18 mol", "0,1 mol"],
		answer: "1 mol",
		explanation: "Mr H₂O = 18 g/mol. n = massa / Mr = 18 / 18 = 1 mol.",
		points: 10
	},
	{
		id: 45,
		topic: "Hukum Dasar Kimia",
		question: "Hukum Kekekalan Massa yang menyatakan bahwa massa zat sebelum dan sesudah reaksi adalah sama dikemukakan oleh...",
		options: ["Antoine Lavoisier", "Joseph Proust", "John Dalton", "Amedeo Avogadro", "Dmitri Mendeleev"],
		answer: "Antoine Lavoisier",
		explanation: "Lavoisier merumuskan Hukum Kekekalan Massa pada abad ke-18 melalui eksperimen sistem tertutup.",
		points: 10
	},
	{
		id: 46,
		topic: "Hukum Perbandingan Tetap",
		question: "Hukum Perbandingan Tetap yang menyatakan perbandingan massa unsur-unsur dalam senyawa selalu tertentu dan tetap adalah hukum...",
		options: ["Hukum Proust", "Hukum Dalton", "Hukum Lavoisier", "Hukum Gay-Lussac", "Hukum Boyle"],
		answer: "Hukum Proust",
		explanation: "Joseph Proust membuktikan perbandingan massa penyusun senyawa selalu konstan.",
		points: 10
	},
	{
		id: 47,
		topic: "Energi Ikatan",
		question: "Besarnya energi yang diperlukan untuk memutuskan 1 mol ikatan kovalen dalam wujud gas disebut...",
		options: ["Energi Ikatan", "Energi Kisi", "Energi Ionisasi", "Afinitas Elektron", "Elektronegativitas"],
		answer: "Energi Ikatan",
		explanation: "Energi ikatan rata-rata adalah energi pemutusan ikatan dalam fase gas.",
		points: 10
	},
	{
		id: 48,
		topic: "Orde Reaksi",
		question: "Jika konsentrasi reaktan dinaikkan 2 kali dan laju reaksi meningkat 4 kali lipat, maka orde reaksinya adalah...",
		options: ["2", "1", "0", "3", "0,5"],
		answer: "2",
		explanation: "2^x = 4 → x = 2 (orde reaksi kedua).",
		points: 10
	},
	{
		id: 49,
		topic: "Kesetimbangan Disosiasi",
		question: "Perbandingan jumlah mol zat yang terurai terhadap jumlah mol zat mula-mula dinamakan...",
		options: ["Derajat Disosiasi (α)", "Tetapan Kesetimbangan", "Fraksi Mol", "Molaritas", "Normalitas"],
		answer: "Derajat Disosiasi (α)",
		explanation: "Derajat disosiasi α = (mol terurai) / (mol mula-mula).",
		points: 10
	},
	{
		id: 50,
		topic: "Asam Basa Lewis",
		question: "Menurut konsep Lewis, basa adalah zat atau spesi yang bertindak sebagai...",
		options: ["Donor Pasangan Elektron", "Akseptor Pasangan Elektron", "Donor Proton", "Akseptor Proton", "Pelepas ion H⁺"],
		answer: "Donor Pasangan Elektron",
		explanation: "Basa Lewis mendonorkan pasangan elektron bebas (PEB), contohnya NH₃.",
		points: 10
	},
	{
		id: 51,
		topic: "Kekuatan Asam",
		question: "Di antara asam halida berikut (HF, HCl, HBr, HI), manakah yang merupakan asam paling kuat?",
		options: ["HI", "HBr", "HCl", "HF", "Semua sama kuat"],
		answer: "HI",
		explanation: "Kekuatan asam halida meningkat dari atas ke bawah (HF < HCl < HBr < HI) karena ikatan H-I paling panjang dan mudah putus.",
		points: 10
	},
	{
		id: 52,
		topic: "Buffer Tubuh",
		question: "Sistem penyangga utama yang menjaga pH cairan darah manusia tetap berada di sekitar 7,4 adalah...",
		options: ["H₂CO₃ / HCO₃⁻", "H₂PO₄⁻ / HPO₄²⁻", "CH₃COOH / CH₃COO⁻", "NH₃ / NH₄⁺", "Hb / HbO₂"],
		answer: "H₂CO₃ / HCO₃⁻",
		explanation: "Sistem buffer asam karbonat-bikarbonat (H₂CO₃ / HCO₃⁻) merupakan buffer utama dalam darah mamalia.",
		points: 10
	},
	{
		id: 53,
		topic: "Faktor Van't Hoff",
		question: "Nilai faktor Van't Hoff (i) untuk larutan elektrolit biner kuat seperti NaCl terionisasi sempurna adalah...",
		options: ["2", "1", "3", "0", "1,5"],
		answer: "2",
		explanation: "NaCl → Na⁺ + Cl⁻ (n = 2 ion). Karena α = 1, maka i = 1 + (2-1)×1 = 2.",
		points: 10
	},
	{
		id: 54,
		topic: "Hukum Faraday I",
		question: "Massa zat yang diendapkan pada elektroda selama elektrolisis sebanding dengan...",
		options: ["Muatan listrik (Q = I × t)", "Suhu larutan", "Volume wadah", "Luas elektroda", "Tekanan udara"],
		answer: "Muatan listrik (Q = I × t)",
		explanation: "Hukum Faraday I: w = (e × I × t) / 96500, massa sebanding dengan jumlah arus dan waktu.",
		points: 10
	},
	{
		id: 55,
		topic: "Potensial Sel Standar",
		question: "Jika E° Zn²⁺/Zn = -0,76 V dan E° Cu²⁺/Cu = +0,34 V, maka E°sel standar sel Volta Zn-Cu adalah...",
		options: ["+1,10 V", "-1,10 V", "+0,42 V", "-0,42 V", "+0,90 V"],
		answer: "+1,10 V",
		explanation: "E°sel = E°katoda - E°anoda = +0,34 - (-0,76) = +1,10 Volt.",
		points: 10
	},
	{
		id: 56,
		topic: "Hidrokarbon Aromatik",
		question: "Senyawa cincin benzena dengan satu gugus metil (-CH₃) memiliki nama IUPAC / lazim...",
		options: ["Toluena (Metilbenzena)", "Anilina", "Fenol", "Nitrobenzena", "Asam Benzoat"],
		answer: "Toluena (Metilbenzena)",
		explanation: "C₆H₅-CH₃ dikenal sebagai toluena atau metilbenzena.",
		points: 10
	},
	{
		id: 57,
		topic: "Uji Kualitatif Senyawa Karbon",
		question: "Pereaksi Fehling atau Tollens digunakan untuk membedakan gugus fungsi...",
		options: ["Aldehid dan Keton", "Alkohol dan Eter", "Asam Karboksilat dan Ester", "Alkana dan Alkena", "Benzena dan Toluena"],
		answer: "Aldehid dan Keton",
		explanation: "Aldehid mereduksi Fehling (endapan merah bata Cu₂O) dan Tollens (cermin perak Ag), sedangkan keton tidak.",
		points: 10
	},
	{
		id: 58,
		topic: "Kimia Biokimia",
		question: "Ikatan yang menghubungkan asam amino satu dengan asam amino lainnya dalam rantai protein adalah...",
		options: ["Ikatan Peptida", "Ikatan Glikosida", "Ikatan Ester", "Ikatan Fosfodiester", "Ikatan Logam"],
		answer: "Ikatan Peptida",
		explanation: "Ikatan peptida terbentuk antara gugus karboksil (-COOH) satu asam amino dan gugus amina (-NH₂) asam amino lain.",
		points: 10
	},
	{
		id: 59,
		topic: "Uji Protein",
		question: "Uji Biuret memberikan warna ungu khas untuk mendeteksi keberadaan...",
		options: ["Ikatan Peptida dalam Protein", "Gula Pereduksi", "Lemak Jenuh", "Cincin Benzena", "Belerang dalam Asam Amino"],
		answer: "Ikatan Peptida dalam Protein",
		explanation: "Reagen Biuret (CuSO₄ + NaOH) bereaksi dengan minimal 2 ikatan peptida menghasilkan kompleks berwarna ungu.",
		points: 10
	},
	{
		id: 60,
		topic: "Kimia Radioaktif",
		question: "Sinar radioaktif yang memiliki daya tembus paling kuat namun daya ionisasi paling lemah adalah...",
		options: ["Sinar Gamma (γ)", "Sinar Alfa (α)", "Sinar Beta (β)", "Sinar X", "Sinar Kosmik"],
		answer: "Sinar Gamma (γ)",
		explanation: "Sinar Gamma merupakan gelombang elektromagnetik berenergi tinggi dengan daya tembus tertinggi.",
		points: 10
	},
	{
		id: 61,
		topic: "Bilangan Kuantum",
		question: "Bilangan kuantum yang menentukan bentuk orbital elektron (s, p, d, f) adalah...",
		options: ["Bilangan Kuantum Azimut (l)", "Bilangan Kuantum Utama (n)", "Bilangan Kuantum Magnetik (m)", "Bilangan Kuantum Spin (s)", "Bilangan Planck"],
		answer: "Bilangan Kuantum Azimut (l)",
		explanation: "l = 0 (s, bola), l = 1 (p, balon terpilin), l = 2 (d), l = 3 (f).",
		points: 10
	},
	{
		id: 62,
		topic: "Prinsip Aufbau",
		question: "Aturan pengisian elektron dari tingkat energi terendah ke tingkat energi yang lebih tinggi dikenal sebagai...",
		options: ["Prinsip Aufbau", "Kaidah Hund", "Larangan Pauli", "Asas Ketidakpastian", "Hukum Moseley"],
		answer: "Prinsip Aufbau",
		explanation: "Aufbau menyatakan orbital dengan energi terendah diisi terlebih dahulu (1s, 2s, 2p, 3s, 3p, 4s, 3d...).",
		points: 10
	},
	{
		id: 63,
		topic: "Kaidah Oktet",
		question: "Molekul berikut yang mengalami penyimpangan kaidah oktet (elektron valensi pusat < 8 atau > 8) adalah...",
		options: ["PCl₅", "CH₄", "NH₃", "H₂O", "CCl₄"],
		answer: "PCl₅",
		explanation: "Atom P pada PCl₅ mengikat 5 klorin sehingga memiliki 10 elektron valensi (oktet berkembang).",
		points: 10
	},
	{
		id: 64,
		topic: "Keelektronegatifan",
		question: "Unsur yang memiliki nilai keelektronegatifan paling tinggi dalam tabel periodik adalah...",
		options: ["Fluorin (F)", "Oksigen (O)", "Klorin (Cl)", "Nitrogen (N)", "Francium (Fr)"],
		answer: "Fluorin (F)",
		explanation: "Fluorin memiliki skala elektronegativitas Pauling tertinggi sebesar 4,0.",
		points: 10
	},
	{
		id: 65,
		topic: "Pemanasan Global & Ozon",
		question: "Senyawa gas buatan yang bertanggung jawab utama merusak lapisan ozon (O₃) di stratosfer adalah...",
		options: ["CFC (Klorofluorokarbon)", "CO₂", "CH₄", "SO₂", "NO₂"],
		answer: "CFC (Klorofluorokarbon)",
		explanation: "Radikal Cl dari CFC memecah ribuan molekul ozon melalui reaksi berantai fotokatalitik.",
		points: 10
	},
	{
		id: 66,
		topic: "Hujan Asam",
		question: "Gas polutan industri yang menjadi penyebab utama terjadinya fenomena hujan asam adalah...",
		options: ["SO₂ dan NO₂", "CO dan CO₂", "CH₄ dan H₂", "He dan Ne", "O₂ dan Ar"],
		answer: "SO₂ dan NO₂",
		explanation: "Oksida belerang (SOx) dan nitrogen (NOx) bereaksi dengan uap air membentuk H₂SO₄ dan HNO₃.",
		points: 10
	},
	{
		id: 67,
		topic: "Senyawa Anorganik",
		question: "Nama kimia IUPAC yang tepat untuk senyawa N₂O₅ adalah...",
		options: ["Dinitrogen Pentaoksida", "Nitrogen Oksida", "Dinitrogen Trioksida", "Nitrogen Dioksida", "Nitrat Penta"],
		answer: "Dinitrogen Pentaoksida",
		explanation: "Tata nama senyawa biner nonlogam: di (2 N) + nitrogen + penta (5 O) + oksida.",
		points: 10
	},
	{
		id: 68,
		topic: "Reaksi Pembakaran",
		question: "Pembakaran tidak sempurna gas hidrokarbon seperti metana menghasilkan jelaga dan gas beracun...",
		options: ["Karbon Monoksida (CO)", "Karbon Dioksida (CO₂)", "Gas Oksigen (O₂)", "Gas Nitrogen (N₂)", "Gas Klorin (Cl₂)"],
		answer: "Karbon Monoksida (CO)",
		explanation: "CO berikatan kuat dengan hemoglobin darah (HbCO) sehingga sangat mematikan.",
		points: 10
	},
	{
		id: 69,
		topic: "Titik Kritis Air",
		question: "Suhu di mana wujud padat, cair, dan gas suatu zat berada dalam kesetimbangan dinamakan...",
		options: ["Titik Tripel", "Titik Didih Normal", "Titik Kritis", "Titik Beku", "Titik Sublimasi"],
		answer: "Titik Tripel",
		explanation: "Titik tripel pada diagram fasa adalah kondisi suhu dan tekanan saat ketiga fasa berdampingan seimbang.",
		points: 10
	},
	{
		id: 70,
		topic: "Kromatografi",
		question: "Metode pemisahan campuran yang didasarkan pada perbedaan kecepatan merambat partikel pada fase diam dan fase gerak adalah...",
		options: ["Kromatografi", "Distilasi", "Filtrasi", "Kristalisasi", "Sublimasi"],
		answer: "Kromatografi",
		explanation: "Kromatografi memanfaatkan partisi antara fase diam (kertas/kolom) dan fase gerak (pelarut).",
		points: 10
	},
	{
		id: 71,
		topic: "Distilasi",
		question: "Pemisahan fraksi-fraksi minyak bumi di kilang minyak dilakukan menggunakan metode...",
		options: ["Distilasi Bertingkat", "Ekstraksi", "Kromatografi Kolom", "Rekristalisasi", "Sedimentasi"],
		answer: "Distilasi Bertingkat",
		explanation: "Fraksionasi minyak bumi memisahkan komponen hidrokarbon berdasarkan perbedaan rentang titik didih.",
		points: 10
	},
	{
		id: 72,
		topic: "Bensin & Oktan",
		question: "Kualitas bahan bakar bensin ditentukan oleh bilangan oktan. Senyawa pembanding dengan nilai oktan 100 adalah...",
		options: ["Isooktana (2,2,4-trimetilpentana)", "n-Heptana", "n-Oktana", "Metana", "Butana"],
		answer: "Isooktana (2,2,4-trimetilpentana)",
		explanation: "Isooktana bernilai oktan 100 (tahan ketukan/knocking), sedangkan n-heptana bernilai 0.",
		points: 10
	},
	{
		id: 73,
		topic: "Reaksi Esterifikasi",
		question: "Reaksi pembentukan ester (senyawa beraroma wangi buah) dibuat dengan mereaksikan...",
		options: ["Asam Karboksilat + Alkohol", "Aldehid + Keton", "Alkohol + Eter", "Alkana + Asam Kuat", "Eter + Basa"],
		answer: "Asam Karboksilat + Alkohol",
		explanation: "R-COOH + R'-OH ⇌ R-COO-R' + H₂O dengan katalis asam sulfat pekat.",
		points: 10
	},
	{
		id: 74,
		topic: "Saponifikasi",
		question: "Reaksi pembuatan sabun melalui hidrolisis trigliserida (lemak/minyak) dengan basa kuat (NaOH/KOH) disebut...",
		options: ["Saponifikasi (Penyabunan)", "Esterifikasi", "Fermentasi", "Kondensasi", "Adisi"],
		answer: "Saponifikasi (Penyabunan)",
		explanation: "Trigliserida + 3 NaOH → Gliserol + 3 Garam Karboksilat (Sabun).",
		points: 10
	},
	{
		id: 75,
		topic: "Polimer Sintetik",
		question: "Pipa paralon air yang umum digunakan di perumahan terbuat dari polimer sintetik...",
		options: ["PVC (Polivinil Klorida)", "Polistirena", "Teflon (PTFE)", "Nilon 66", "Poliester"],
		answer: "PVC (Polivinil Klorida)",
		explanation: "PVC adalah polimer adisi dari monomer vinil klorida (CH₂=CHCl).",
		points: 10
	},
	{
		id: 76,
		topic: "Teflon",
		question: "Lapisan anti-lengket pada wajan masak modern (Teflon) tersusun dari monomer...",
		options: ["Tetrafluoroetena (CF₂=CF₂)", "Vinil Klorida", "Stirena", "Propena", "Isoprena"],
		answer: "Tetrafluoroetena (CF₂=CF₂)",
		explanation: "Teflon adalah politetrafluoroetilena (PTFE), sangat stabil secara termal dan tahan kimia.",
		points: 10
	},
	{
		id: 77,
		topic: "Kinetika Enzim",
		question: "Enzim dalam tubuh berfungsi sebagai biokatalis yang mempercepat reaksi metabolisme. Komponen penyusun utama enzim adalah...",
		options: ["Protein", "Karbohidrat", "Asam Lemak", "Mineral", "Asam Nukleat"],
		answer: "Protein",
		explanation: "Hampir semua enzim adalah protein globular yang memiliki sisi aktif spesifik.",
		points: 10
	},
	{
		id: 78,
		topic: "Kimia Unsur Logam Alkali",
		question: "Logam alkali golongan IA disimpan di dalam minyak tanah (kerosin) karena...",
		options: ["Sangat reaktif bereaksi dengan air dan oksigen udara", "Mudah menguap", "Beracun", "Mudah membeku", "Menyerap panas"],
		answer: "Sangat reaktif bereaksi dengan air dan oksigen udara",
		explanation: "Logam alkali (Na, K) mudah teroksidasi dan bereaksi eksplosif dengan uap air menghasilkan gas H₂ dan panas.",
		points: 10
	},
	{
		id: 79,
		topic: "Kembang Api & Uji Nyala",
		question: "Dalam uji nyala kation logam alkali dan alkali tanah, ion Kalsium (Ca²⁺) menghasilkan warna nyala khas...",
		options: ["Merah Bata", "Kuning Terang", "Ungu / Lilac", "Hijau Apel", "Biru"],
		answer: "Merah Bata",
		explanation: "Na (kuning), K (ungu/lilac), Ca (merah bata), Ba (hijau apel), Sr (merah tua).",
		points: 10
	},
	{
		id: 80,
		topic: "Halogen",
		question: "Unsur halogen yang berwujud cair berwarna cokelat kemerahan pada suhu kamar adalah...",
		options: ["Bromin (Br₂)", "Fluorin (F₂)", "Klorin (Cl₂)", "Iodin (I₂)", "Astatin (At)"],
		answer: "Bromin (Br₂)",
		explanation: "F₂ & Cl₂ adalah gas, Br₂ adalah cairan, sedangkan I₂ adalah padatan ungu kehitaman.",
		points: 10
	},
	{
		id: 81,
		topic: "Air Sadah",
		question: "Kesadahan sementara pada air disebabkan oleh adanya garam bikarbonat dari ion...",
		options: ["Ca²⁺ dan Mg²⁺", "Na⁺ dan K⁺", "Fe³⁺ dan Al³⁺", "Cu²⁺ dan Zn²⁺", "Pb²⁺ dan Hg²⁺"],
		answer: "Ca²⁺ dan Mg²⁺",
		explanation: "Kesadahan sementara disebabkan oleh Ca(HCO₃)₂ atau Mg(HCO₃)₂ yang dapat dihilangkan dengan pemanasan.",
		points: 10
	},
	{
		id: 82,
		topic: "Proses Haber-Bosch",
		question: "Sintesis gas amonia (NH₃) secara industri dari gas N₂ dan H₂ menggunakan katalis besi dinamakan proses...",
		options: ["Proses Haber-Bosch", "Proses Kontak", "Proses Solvay", "Proses Hall-Heroult", "Proses Ostwald"],
		answer: "Proses Haber-Bosch",
		explanation: "N₂(g) + 3H₂(g) ⇌ 2NH₃(g) pada suhu ~450°C dan tekanan 200 atm dengan katalis Fe.",
		points: 10
	},
	{
		id: 83,
		topic: "Proses Kontak",
		question: "Pembuatan asam sulfat (H₂SO₄) pekat dalam industri kimia menggunakan katalis V₂O₅ pada proses...",
		options: ["Proses Kontak", "Proses Bilik Timbal", "Proses Deacon", "Proses Down", "Proses Frasch"],
		answer: "Proses Kontak",
		explanation: "Proses Kontak mengoksidasi SO₂ menjadi SO₃ dengan katalis Vanadium Pentoksida (V₂O₅).",
		points: 10
	},
	{
		id: 84,
		topic: "Pengolahan Aluminium",
		question: "Ekstraksi logam aluminium dari bijih bauksit melalui peleburan dalam kriolit (Na₃AlF₆) disebut proses...",
		options: ["Proses Hall-Heroult", "Proses Tanur Tiup", "Proses Bessemer", "Proses Kroll", "Proses Bayer"],
		answer: "Proses Hall-Heroult",
		explanation: "Proses Hall-Heroult mengelektrolisis lelehan Al₂O₃ yang dilarutkan dalam kriolit cair.",
		points: 10
	},
	{
		id: 85,
		topic: "Kaidah Hund",
		question: "Kaidah yang menyatakan bahwa pengisian elektron pada orbital setingkat harus tidak berpasangan terlebih dahulu sebelum berpasangan adalah...",
		options: ["Kaidah Hund", "Asas Aufbau", "Larangan Pauli", "Hukum Hess", "Hukum Gay-Lussac"],
		answer: "Kaidah Hund",
		explanation: "Hund menyatakan elektron menempati orbital berenergi sama secara paralel tunggal sebelum berpasangan.",
		points: 10
	},
	{
		id: 86,
		topic: "Larangan Pauli",
		question: "Asas Larangan Pauli menyatakan bahwa dalam satu atom tidak boleh ada dua elektron yang memiliki keempat...",
		options: ["Bilangan kuantum yang identik sama", "Massa yang sama", "Muatan yang berbeda", "Tingkat energi sama", "Orbit yang berbeda"],
		answer: "Bilangan kuantum yang identik sama",
		explanation: "Dua elektron dalam orbital yang sama harus memiliki spin berlawanan (+1/2 dan -1/2).",
		points: 10
	},
	{
		id: 87,
		topic: "Larutan Standar",
		question: "Larutan yang konsentrasinya telah diketahui secara pasti dan akurat untuk titrasi disebut...",
		options: ["Larutan Standar / Baku", "Larutan Sampel", "Larutan Jenuh", "Larutan Koloid", "Larutan Blanko"],
		answer: "Larutan Standar / Baku",
		explanation: "Larutan standar primer/sekunder digunakan sebagai titran untuk menentukan konsentrasi analit.",
		points: 10
	},
	{
		id: 88,
		topic: "Reaksi Adisi",
		question: "Reaksi pemutusan ikatan rangkap dua (C=C) pada alkena menjadi ikatan tunggal (C-C) dengan gas H₂ atau Br₂ disebut reaksi...",
		options: ["Adisi", "Substitusi", "Eliminasi", "Oksidasi", "Kondensasi"],
		answer: "Adisi",
		explanation: "Reaksi adisi menambahkan atom pada ikatan rangkap sehingga molekul menjadi jenuh.",
		points: 10
	},
	{
		id: 89,
		topic: "Aturan Markovnikov",
		question: "Pada adisi asam halida (HX) pada alkena asimetris, atom H akan terikat pada atom C berikatan rangkap yang memiliki...",
		options: ["Jumlah atom H lebih banyak", "Jumlah atom H lebih sedikit", "Rantai terpanjang", "Muatan positif", "Elektron terluar sedikit"],
		answer: "Jumlah atom H lebih banyak",
		explanation: "Kaidah Markovnikov: 'Yang kaya hidrogen semakin kaya hidrogen'.",
		points: 10
	},
	{
		id: 90,
		topic: "Karbohidrat",
		question: "Gula disakarida yang tersusun atas molekul glukosa dan fruktosa (gula tebu/pasir) adalah...",
		options: ["Sukrosa", "Maltosa", "Laktosa", "Galaktosa", "Selulosa"],
		answer: "Sukrosa",
		explanation: "Sukrosa = Glukosa + Fruktosa. Maltosa = Glukosa + Glukosa. Laktosa = Glukosa + Galaktosa.",
		points: 10
	},
	{
		id: 91,
		topic: "Uji Iodin",
		question: "Uji larutan iodin (I₂) terhadap amilum/pati pada tepung menghasilkan perubahan warna khas menjadi...",
		options: ["Biru Kehitaman / Ungu Tua", "Merah Bata", "Kuning Terang", "Hijau Muda", "Cokelat Transparan"],
		answer: "Biru Kehitaman / Ungu Tua",
		explanation: "Iodin terperangkap di dalam heliks amilosa menghasilkan kompleks warna biru-hitam pekat.",
		points: 10
	},
	{
		id: 92,
		topic: "Asam Lemak Jenuh",
		question: "Asam lemak yang tidak memiliki ikatan rangkap pada rantai karbonnya dan umumnya berwujud padat pada suhu kamar adalah...",
		options: ["Asam Lemak Jenuh", "Asam Lemak Tak Jenuh Tunggal", "Asam Lemak Tak Jenuh Ganda", "Asam Amino Esensial", "Minyak Nabati"],
		answer: "Asam Lemak Jenuh",
		explanation: "Asam lemak jenuh (contoh: asam palmitat, stearat) memiliki ikatan tunggal C-C sehingga molekul tersusun rapat dan titik lelehnya tinggi.",
		points: 10
	},
	{
		id: 93,
		topic: "Denaturasi Protein",
		question: "Kerusakan struktur tersier dan sekunder protein akibat pemanasan, pH ekstrem, atau alkohol disebut...",
		options: ["Denaturasi", "Koagulasi Alami", "Hidrolisis Enzimatik", "Polimerisasi", "Oksidasi"],
		answer: "Denaturasi",
		explanation: "Denaturasi merusak ikatan hidrogen dan disulfida tanpa merusak urutan asam amino primer.",
		points: 10
	},
	{
		id: 94,
		topic: "Sifat Amfoter",
		question: "Zat yang dapat bereaksi dengan asam maupun basa (contohnya Al₂O₃ dan asam amino) memiliki sifat...",
		options: ["Amfoter", "Netral", "Autotrof", "Higroskopis", "Aperiodik"],
		answer: "Amfoter",
		explanation: "Spesi amfoter dapat bertindak sebagai asam atau basa tergantung lingkungan reaksinya.",
		points: 10
	},
	{
		id: 95,
		topic: "Kimia Unsur Gas Mulia",
		question: "Senyawa gas mulia pertama yang berhasil disintesis oleh Neil Bartlett pada tahun 1962 adalah senyawa dari unsur...",
		options: ["Xenon (Xe)", "Helium (He)", "Neon (Ne)", "Argon (Ar)", "Kripton (Kr)"],
		answer: "Xenon (Xe)",
		explanation: "Senyawa pertama adalah XePtF₆ (Xenon heksafluoroplatinat).",
		points: 10
	},
	{
		id: 96,
		topic: "Termokimia",
		question: "Jumlah energi yang dilepaskan ketika 1 mol kisi ionik padat terbentuk dari ion-ion gasnya disebut...",
		options: ["Energi Kisi", "Energi Hidrasi", "Energi Ionisasi", "Entalpi Pelarutan", "Energi Ikatan"],
		answer: "Energi Kisi",
		explanation: "Energi kisi mengukur kestabilan senyawa ionik kristalin padat.",
		points: 10
	},
	{
		id: 97,
		topic: "Hukum Gay-Lussac",
		question: "Hukum Perbandingan Volume menyatakan bahwa pada suhu dan tekanan sama, volume gas-gas yang bereaksi dan hasil reaksi berbanding sebagai...",
		options: ["Bilangan bulat dan sederhana (Koefisien reaksi)", "Massa atom relatif", "Kuadrat jari-jari", "Kerapatan gas", "Energi aktivasi"],
		answer: "Bilangan bulat dan sederhana (Koefisien reaksi)",
		explanation: "Perbandingan volume gas pada P dan T sama identik dengan perbandingan koefisien reaksinya.",
		points: 10
	},
	{
		id: 98,
		topic: "Titik Didih Alkana",
		question: "Di antara senyawa alkana berikut (Metana, Etana, Propana, Butana, Pentana), manakah yang memiliki titik didih paling tinggi?",
		options: ["Pentana", "Butana", "Propana", "Etana", "Metana"],
		answer: "Pentana",
		explanation: "Semakin panjang rantai karbon (massa Mr makin besar), gaya Van der Waals/London semakin kuat sehingga titik didih tertinggi adalah pentana.",
		points: 10
	},
	{
		id: 99,
		topic: "Elektrolisis Air",
		question: "Pada elektrolisis air murni dengan sedikit asam sulfat, rasio volume gas Hidrogen (H₂) di katoda terhadap Oksigen (O₂) di anoda adalah...",
		options: ["2 : 1", "1 : 1", "1 : 2", "3 : 1", "4 : 1"],
		answer: "2 : 1",
		explanation: "Reaksi: 2H₂O(l) → 2H₂(g) + O₂(g). Koefisien H₂ = 2 dan O₂ = 1 sehingga perbandingan volumenya 2:1.",
		points: 10
	},
	{
		id: 100,
		topic: "Kimia Masa Depan & Nanoteknologi",
		question: "Alotrop karbon berbentuk bola berongga dengan 60 atom karbon yang sangat kuat dan digunakan dalam nanoteknologi adalah...",
		options: ["Buckyball (Fullerene C60)", "Grafit", "Intan", "Graphene", "Karbon Aktif"],
		answer: "Buckyball (Fullerene C60)",
		explanation: "Buckminsterfullerene (C60) adalah struktur karbon bola menyerupai bola sepak yang ditemukan oleh Kroto, Curl, dan Smalley.",
		points: 10
	}
];
