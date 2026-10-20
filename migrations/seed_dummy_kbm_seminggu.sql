-- ============================================================================
-- SKRIP SQL: SEED DATA DUMMY KBM 1 MINGGU LENGKAP (SEMUA KELAS & GURU)
-- GuruApp — Absensi Harian, Absensi Mapel, Jurnal KBM, & Nilai Formatif/Sumatif
-- ============================================================================
-- Kalender KBM:
-- HARI EFEKTIF BELAJAR: Senin, Selasa, Rabu, Kamis, Sabtu, Minggu
-- HARI JUMAT: LIBUR KBM (Tidak ada kegiatan belajar mengajar)
-- ============================================================================
-- PETUNJUK:
-- 1. Buka Supabase Dashboard > SQL Editor
-- 2. Tempel (Paste) seluruh skrip ini, lalu klik tombol "Run"
-- ============================================================================

DO $$
DECLARE
    -- 6 Hari Efektif Belajar dalam 1 Minggu (Senin-Kamis, Sabtu, Minggu | Jumat Libur)
    arr_tgl DATE[] := ARRAY[
        DATE '2026-10-12', -- 1. Senin
        DATE '2026-10-13', -- 2. Selasa
        DATE '2026-10-14', -- 3. Rabu
        DATE '2026-10-15', -- 4. Kamis
        DATE '2026-10-17', -- 5. Sabtu
        DATE '2026-10-18'  -- 6. Minggu
    ];
    v_tahun_ajar TEXT := '2026/2027';
    v_semester   INTEGER := 1;

    -- Variabel Loop
    r_kelas      RECORD;
    r_guru       RECORD;
    r_kbm        RECORD;
    r_siswa      RECORD;
    v_mapel_name TEXT;
    v_mapel_code TEXT;
    v_current_date DATE;
    d            INTEGER;
    v_sesi_h_id  TEXT;
    v_sesi_m_id  TEXT;
    v_jurnal_id  TEXT;
    v_tugas_id   TEXT;
    v_status     TEXT;
    v_ket        TEXT;
    v_nilai      NUMERIC;
    v_siswa_idx  INTEGER;
    v_kbm_count  INTEGER := 0;

    -- Counter Statistik
    count_absensi_harian INTEGER := 0;
    count_absensi_mapel  INTEGER := 0;
    count_jurnal         INTEGER := 0;
    count_tugas          INTEGER := 0;
    count_nilai          INTEGER := 0;

    -- Contoh Materi Pembelajaran Realistis
    arr_materi TEXT[] := ARRAY[
        'Eksplorasi Konsep Dasar & Pemetaan Masalah Kontekstual',
        'Analisis Kasus Kritis & Diskusi Terbimbing Kelompok',
        'Praktik Implementasi Proyek & Simulasi Terarah',
        'Presentasi Kelompok & Forum Uji Argumen Terbuka',
        'Latihan Soal HOTS & Penugasan Portofolio Mandiri',
        'Refleksi Pembelajaran, Kuis Singkat & Penguatan Konsep'
    ];

BEGIN
    -- 0. AMBIL TAHUN AJAR AKTIF DARI DATABASE JIKA TERSEDIA
    SELECT nama, semester INTO v_tahun_ajar, v_semester 
    FROM public.tahun_ajar 
    WHERE is_aktif = TRUE 
    LIMIT 1;

    IF v_tahun_ajar IS NULL THEN
        v_tahun_ajar := '2026/2027';
        v_semester := 1;
    END IF;

    RAISE NOTICE '>>> MEMULAI SEED DATA KBM 1 MINGGU EFEKTIF (Senin-Kamis, Sabtu, Minggu) | TA: % Sem: % <<<', 
        v_tahun_ajar, v_semester;

    -- ========================================================================
    -- 1. PEMBERSIHAN DATA SIMULASI DUMMY LAMA (Mencegah Konflik & Duplikasi)
    -- ========================================================================
    DELETE FROM public.nilai_siswa WHERE tugas_id LIKE 'TGS-DUMMY-%';
    DELETE FROM public.nilai_tugas WHERE tugas_id LIKE 'TGS-DUMMY-%';
    DELETE FROM public.jurnal WHERE id LIKE 'JRN-DUMMY-%';
    DELETE FROM public.absensi_mapel_siswa WHERE sesi_id LIKE 'SESI-M-DUMMY-%';
    DELETE FROM public.absensi_mapel WHERE sesi_id LIKE 'SESI-M-DUMMY-%';
    DELETE FROM public.absensi_harian_siswa WHERE sesi_id LIKE 'SESI-H-DUMMY-%';
    DELETE FROM public.absensi_harian WHERE sesi_id LIKE 'SESI-H-DUMMY-%';

    -- ========================================================================
    -- 2. PASTIKAN RELASI PENUGASAN (GURU_KBM) TERSEDIA UNTUK SEMUA GURU & KELAS
    -- ========================================================================
    SELECT COUNT(*) INTO v_kbm_count FROM public.guru_kbm;

    IF v_kbm_count = 0 THEN
        RAISE NOTICE 'Tabel guru_kbm kosong. Menginisialisasi penugasan otomatis...';
        FOR r_guru IN SELECT id_user, nama_lengkap FROM public.users WHERE role IN ('Guru', 'Admin', 'Kurikulum') LOOP
            FOR r_kelas IN SELECT nama_kelas FROM public.kelas LIMIT 3 LOOP
                SELECT mapel INTO v_mapel_name FROM public.mapel ORDER BY RANDOM() LIMIT 1;
                IF v_mapel_name IS NOT NULL THEN
                    INSERT INTO public.guru_kbm (id_kbm, id_user, kelas, mapel, tahun_ajar, semester)
                    VALUES (
                        'KBM-' || SUBSTRING(r_guru.id_user::TEXT, 1, 6) || '-' || REPLACE(r_kelas.nama_kelas, ' ', ''),
                        r_guru.id_user,
                        r_kelas.nama_kelas,
                        v_mapel_name,
                        v_tahun_ajar,
                        v_semester
                    ) ON CONFLICT DO NOTHING;
                END IF;
            END LOOP;
        END LOOP;
    END IF;

    -- ========================================================================
    -- 3. GENERATE ABSENSI HARIAN (6 HARI EFEKTIF: SENIN, SELASA, RABU, KAMIS, SABTU, MINGGU)
    -- ========================================================================
    FOR r_kelas IN SELECT nama_kelas FROM public.kelas ORDER BY nama_kelas LOOP
        FOR d IN 1..6 LOOP
            v_current_date := arr_tgl[d];
            v_sesi_h_id := 'SESI-H-DUMMY-' || REPLACE(r_kelas.nama_kelas, ' ', '') || '-' || TO_CHAR(v_current_date, 'YYYYMMDD');

            INSERT INTO public.absensi_harian (sesi_id, kelas, tanggal, tahun_ajar, semester)
            VALUES (v_sesi_h_id, r_kelas.nama_kelas, v_current_date, v_tahun_ajar, v_semester)
            ON CONFLICT (sesi_id) DO NOTHING;

            count_absensi_harian := count_absensi_harian + 1;

            v_siswa_idx := 0;
            FOR r_siswa IN 
                SELECT id, nama_lengkap 
                FROM public.siswa 
                WHERE kelas = r_kelas.nama_kelas AND status = 'Aktif' 
                ORDER BY nama_lengkap 
            LOOP
                v_siswa_idx := v_siswa_idx + 1;

                -- Distribusi status kehadiran realistis:
                IF (v_siswa_idx + d) % 19 = 0 THEN
                    v_status := 'Alfa';
                    v_ket := '';
                ELSIF (v_siswa_idx + d) % 13 = 0 THEN
                    v_status := 'Sakit';
                    v_ket := 'Demam / Sakit Kepala';
                ELSIF (v_siswa_idx + d) % 11 = 0 THEN
                    v_status := 'Izin';
                    v_ket := 'Acara Keluarga';
                ELSE
                    v_status := 'Hadir';
                    v_ket := '';
                END IF;

                INSERT INTO public.absensi_harian_siswa (sesi_id, siswa_id, status, keterangan)
                VALUES (v_sesi_h_id, r_siswa.id, v_status, v_ket)
                ON CONFLICT DO NOTHING;
            END LOOP;
        END LOOP;
    END LOOP;

    -- ========================================================================
    -- 4. GENERATE JURNAL KBM & ABSENSI MAPEL UNTUK SEMUA GURU DAN KELAS
    -- ========================================================================
    FOR r_kbm IN 
        SELECT DISTINCT 
            kbm.id_user AS guru_id, 
            kbm.kelas, 
            kbm.mapel,
            COALESCE(u.nama_lengkap, 'Guru Pengampu') AS nama_guru
        FROM public.guru_kbm kbm
        LEFT JOIN public.users u ON u.id_user = kbm.id_user
        WHERE kbm.kelas IS NOT NULL 
          AND kbm.mapel IS NOT NULL 
          AND kbm.id_user IS NOT NULL
        ORDER BY kbm.kelas, kbm.mapel
    LOOP
        v_mapel_code := SUBSTRING(MD5(r_kbm.mapel) FROM 1 FOR 4);

        -- Sesi KBM 1: Hari Selasa (2026-10-13)
        v_current_date := arr_tgl[2];
        v_jurnal_id := 'JRN-DUMMY-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code || '-1';
        
        INSERT INTO public.jurnal (
            id, guru_id, kelas, mapel, tanggal, jam_ke, pertemuan_ke,
            materi, kegiatan, metode, hambatan, solusi, tuntas, tahun_ajar, semester
        ) VALUES (
            v_jurnal_id,
            r_kbm.guru_id,
            r_kbm.kelas,
            r_kbm.mapel,
            v_current_date,
            '1-2',
            '3',
            arr_materi[1] || ' pada Mata Pelajaran ' || r_kbm.mapel,
            'Guru membuka pembelajaran dengan apersepsi. Siswa berkelompok memetakan studi kasus dan menyusun resume konsep.',
            'Diskusi, Tanya Jawab',
            '',
            '',
            TRUE,
            v_tahun_ajar,
            v_semester
        ) ON CONFLICT (id) DO NOTHING;

        count_jurnal := count_jurnal + 1;

        -- Sesi Absensi Mapel 1
        v_sesi_m_id := 'SESI-M-DUMMY-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code || '-1';
        INSERT INTO public.absensi_mapel (sesi_id, guru_id, kelas, mapel, tanggal, jam_ke, tahun_ajar, semester)
        VALUES (v_sesi_m_id, r_kbm.guru_id, r_kbm.kelas, r_kbm.mapel, v_current_date, '1-2', v_tahun_ajar, v_semester)
        ON CONFLICT (sesi_id) DO NOTHING;

        count_absensi_mapel := count_absensi_mapel + 1;

        FOR r_siswa IN SELECT id FROM public.siswa WHERE kelas = r_kbm.kelas AND status = 'Aktif' LOOP
            INSERT INTO public.absensi_mapel_siswa (sesi_id, siswa_id, status, keterangan)
            VALUES (v_sesi_m_id, r_siswa.id, 'Hadir', '')
            ON CONFLICT DO NOTHING;
        END LOOP;

        -- Sesi KBM 2: Hari Minggu (2026-10-18)
        v_current_date := arr_tgl[6];
        v_jurnal_id := 'JRN-DUMMY-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code || '-2';
        
        INSERT INTO public.jurnal (
            id, guru_id, kelas, mapel, tanggal, jam_ke, pertemuan_ke,
            materi, kegiatan, metode, hambatan, solusi, tuntas, tahun_ajar, semester
        ) VALUES (
            v_jurnal_id,
            r_kbm.guru_id,
            r_kbm.kelas,
            r_kbm.mapel,
            v_current_date,
            '3-4',
            '4',
            arr_materi[3] || ' (Simulasi ' || r_kbm.mapel || ')',
            'Siswa mempraktikkan materi ajar di kelas, dilanjutkan presentasi hasil kerja kelompok dan tanya jawab.',
            'Praktikum, Presentasi',
            'Waktu terbatas sehingga sesi tanggapan kelompok dibatasi.',
            'Guru memberikan umpan balik tertulis di rubrik penilaian.',
            TRUE,
            v_tahun_ajar,
            v_semester
        ) ON CONFLICT (id) DO NOTHING;

        count_jurnal := count_jurnal + 1;

        -- Sesi Absensi Mapel 2
        v_sesi_m_id := 'SESI-M-DUMMY-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code || '-2';
        INSERT INTO public.absensi_mapel (sesi_id, guru_id, kelas, mapel, tanggal, jam_ke, tahun_ajar, semester)
        VALUES (v_sesi_m_id, r_kbm.guru_id, r_kbm.kelas, r_kbm.mapel, v_current_date, '3-4', v_tahun_ajar, v_semester)
        ON CONFLICT (sesi_id) DO NOTHING;

        count_absensi_mapel := count_absensi_mapel + 1;

        FOR r_siswa IN SELECT id FROM public.siswa WHERE kelas = r_kbm.kelas AND status = 'Aktif' LOOP
            INSERT INTO public.absensi_mapel_siswa (sesi_id, siswa_id, status, keterangan)
            VALUES (v_sesi_m_id, r_siswa.id, 'Hadir', '')
            ON CONFLICT DO NOTHING;
        END LOOP;

        -- ====================================================================
        -- 5. GENERATE DATA NILAI: FORMATIF & SUMATIF LENGKAP
        -- ====================================================================
        
        -- A. FORMATIF 1 (Kuis Konsep - Selasa 2026-10-13)
        v_tugas_id := 'TGS-DUMMY-F1-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code;
        INSERT INTO public.nilai_tugas (
            tugas_id, guru_id, kategori, type, deskripsi, kelas, mapel,
            tanggal, tahun_ajar, semester, mode_penilaian, total_soal, skala_maks, pembulatan
        ) VALUES (
            v_tugas_id,
            r_kbm.guru_id,
            'Formatif 1: Pemahaman Konsep ' || r_kbm.mapel,
            'Formatif',
            'Penilaian formatif awal untuk mengukur pemahaman konsep dasar siswa.',
            r_kbm.kelas,
            r_kbm.mapel,
            arr_tgl[2],
            v_tahun_ajar,
            v_semester,
            'langsung',
            100,
            100,
            'decimal_1'
        ) ON CONFLICT (tugas_id) DO NOTHING;

        count_tugas := count_tugas + 1;

        FOR r_siswa IN SELECT id, nama_lengkap FROM public.siswa WHERE kelas = r_kbm.kelas AND status = 'Aktif' LOOP
            v_nilai := 75 + (ABS(HASHTEXT(r_siswa.id::TEXT || v_tugas_id)) % 22);
            INSERT INTO public.nilai_siswa (tugas_id, siswa_id, nama_siswa, nilai)
            VALUES (v_tugas_id, r_siswa.id, r_siswa.nama_lengkap, v_nilai)
            ON CONFLICT DO NOTHING;
            count_nilai := count_nilai + 1;
        END LOOP;

        -- B. FORMATIF 2 (Tugas Portofolio & Diskusi - Kamis 2026-10-15)
        v_tugas_id := 'TGS-DUMMY-F2-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code;
        INSERT INTO public.nilai_tugas (
            tugas_id, guru_id, kategori, type, deskripsi, kelas, mapel,
            tanggal, tahun_ajar, semester, mode_penilaian, total_soal, skala_maks, pembulatan
        ) VALUES (
            v_tugas_id,
            r_kbm.guru_id,
            'Formatif 2: Penugasan Portofolio & Praktik ' || r_kbm.mapel,
            'Formatif',
            'Penilaian formatif performa proses kerja kelompok dan presentasi.',
            r_kbm.kelas,
            r_kbm.mapel,
            arr_tgl[4],
            v_tahun_ajar,
            v_semester,
            'langsung',
            100,
            100,
            'decimal_1'
        ) ON CONFLICT (tugas_id) DO NOTHING;

        count_tugas := count_tugas + 1;

        FOR r_siswa IN SELECT id, nama_lengkap FROM public.siswa WHERE kelas = r_kbm.kelas AND status = 'Aktif' LOOP
            v_nilai := 78 + (ABS(HASHTEXT(r_siswa.id::TEXT || v_tugas_id)) % 21);
            INSERT INTO public.nilai_siswa (tugas_id, siswa_id, nama_siswa, nilai)
            VALUES (v_tugas_id, r_siswa.id, r_siswa.nama_lengkap, v_nilai)
            ON CONFLICT DO NOTHING;
            count_nilai := count_nilai + 1;
        END LOOP;

        -- C. SUMATIF 1 (Sumatif Lingkup Materi 1 - Sabtu 2026-10-17)
        v_tugas_id := 'TGS-DUMMY-S1-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code;
        INSERT INTO public.nilai_tugas (
            tugas_id, guru_id, kategori, type, deskripsi, kelas, mapel,
            tanggal, tahun_ajar, semester, mode_penilaian, total_soal, skala_maks, pembulatan
        ) VALUES (
            v_tugas_id,
            r_kbm.guru_id,
            'Sumatif Lingkup Materi 1 (SLM-1) ' || r_kbm.mapel,
            'Sumatif',
            'Asesmen sumatif untuk mengukur ketercapaian tujuan pembelajaran Bab 1.',
            r_kbm.kelas,
            r_kbm.mapel,
            arr_tgl[5],
            v_tahun_ajar,
            v_semester,
            'langsung',
            100,
            100,
            'decimal_1'
        ) ON CONFLICT (tugas_id) DO NOTHING;

        count_tugas := count_tugas + 1;

        FOR r_siswa IN SELECT id, nama_lengkap FROM public.siswa WHERE kelas = r_kbm.kelas AND status = 'Aktif' LOOP
            v_nilai := 66 + (ABS(HASHTEXT(r_siswa.id::TEXT || v_tugas_id)) % 30);
            INSERT INTO public.nilai_siswa (tugas_id, siswa_id, nama_siswa, nilai)
            VALUES (v_tugas_id, r_siswa.id, r_siswa.nama_lengkap, v_nilai)
            ON CONFLICT DO NOTHING;
            count_nilai := count_nilai + 1;
        END LOOP;

        -- D. SUMATIF 2 (Sumatif Tengah Semester / STS - Minggu 2026-10-18)
        v_tugas_id := 'TGS-DUMMY-S2-' || SUBSTRING(r_kbm.guru_id::TEXT, 1, 8) || '-' || REPLACE(r_kbm.kelas, ' ', '') || '-' || v_mapel_code;
        INSERT INTO public.nilai_tugas (
            tugas_id, guru_id, kategori, type, deskripsi, kelas, mapel,
            tanggal, tahun_ajar, semester, mode_penilaian, total_soal, skala_maks, pembulatan
        ) VALUES (
            v_tugas_id,
            r_kbm.guru_id,
            'Sumatif Tengah Semester (STS) ' || r_kbm.mapel,
            'Sumatif',
            'Evaluasi sumatif tengah semester terintegrasi materi tengah semester.',
            r_kbm.kelas,
            r_kbm.mapel,
            arr_tgl[6],
            v_tahun_ajar,
            v_semester,
            'langsung',
            100,
            100,
            'decimal_1'
        ) ON CONFLICT (tugas_id) DO NOTHING;

        count_tugas := count_tugas + 1;

        FOR r_siswa IN SELECT id, nama_lengkap FROM public.siswa WHERE kelas = r_kbm.kelas AND status = 'Aktif' LOOP
            v_nilai := 70 + (ABS(HASHTEXT(r_siswa.id::TEXT || v_tugas_id)) % 27);
            INSERT INTO public.nilai_siswa (tugas_id, siswa_id, nama_siswa, nilai)
            VALUES (v_tugas_id, r_siswa.id, r_siswa.nama_lengkap, v_nilai)
            ON CONFLICT DO NOTHING;
            count_nilai := count_nilai + 1;
        END LOOP;

    END LOOP;

    RAISE NOTICE '=========================================================';
    RAISE NOTICE 'SEED DATA SIMULASI KBM 1 MINGGU SELESAI!';
    RAISE NOTICE '- Hari Efektif Belajar        : Senin, Selasa, Rabu, Kamis, Sabtu, Minggu';
    RAISE NOTICE '- Hari Libur KBM              : Jumat (Tidak ada KBM)';
    RAISE NOTICE '- Sesi Absensi Harian Terbuat : %', count_absensi_harian;
    RAISE NOTICE '- Sesi Absensi Mapel Terbuat  : %', count_absensi_mapel;
    RAISE NOTICE '- Jurnal KBM Guru Terbuat     : %', count_jurnal;
    RAISE NOTICE '- Tugas Penilaian Terbuat     : % (Formatif & Sumatif)', count_tugas;
    RAISE NOTICE '- Detail Nilai Siswa Masuk    : % baris nilai', count_nilai;
    RAISE NOTICE '=========================================================';
END $$;
