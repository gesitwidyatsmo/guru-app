-- ===========================================================================
-- MIGRATION: CLEANUP JAM_KE TIDAK BAKU PADA ABSENSI_MAPEL DAN JURNAL
-- Menormalisasi format jam dinding ("7.55-10.15"), deretan jam ("5-6-7"),
-- awalan kata ("Jam 2-3"), dan spasi berlebih menjadi format standar baku ("2-4", "5-7", dll).
-- ===========================================================================

-- 1. Normalisasi absensi_mapel
UPDATE public.absensi_mapel SET jam_ke = '2-3' WHERE sesi_id = 'SESI-M-pxpwa58fe'; -- "Jam 2-3"
UPDATE public.absensi_mapel SET jam_ke = '2-4' WHERE sesi_id = 'SESI-M-vvqf55l1v'; -- "7.55-10.15" (JP 2 - 4)
UPDATE public.absensi_mapel SET jam_ke = '5-7' WHERE sesi_id = 'SESI-M-smrd3z4nn'; -- "5-6-7"
UPDATE public.absensi_mapel SET jam_ke = '1-3' WHERE sesi_id = 'SESI-M-rbtdq95hx'; -- "1 - 3"
UPDATE public.absensi_mapel SET jam_ke = '3-4' WHERE sesi_id = 'SESI-M-9ca0mqbdx'; -- "3, 4,"
UPDATE public.absensi_mapel SET jam_ke = '4-6' WHERE sesi_id = 'SESI-M-ypejrt4fh'; -- "4-5-6"
UPDATE public.absensi_mapel SET jam_ke = '6-7' WHERE sesi_id = 'SESI-M-xlr1qvnhg'; -- "Jam 6-7"
UPDATE public.absensi_mapel SET jam_ke = '5-7' WHERE sesi_id = 'SESI-M-633avl1t2'; -- "5 - 7"
UPDATE public.absensi_mapel SET jam_ke = '5-7' WHERE sesi_id = 'SESI-M-4w6werm74'; -- "5-6-7"
UPDATE public.absensi_mapel SET jam_ke = '5-7' WHERE sesi_id = 'SESI-M-zfiyrhju6'; -- "5-6-7"
UPDATE public.absensi_mapel SET jam_ke = '3-4' WHERE sesi_id = 'SESI-M-3onw6tkju'; -- "3 dan 4"
UPDATE public.absensi_mapel SET jam_ke = '1-3' WHERE sesi_id = 'SESI-M-casm0gms5'; -- "1 - 3"

-- 2. Normalisasi jurnal
UPDATE public.jurnal SET jam_ke = '1-3' WHERE id = 'pu079k16u'; -- "1 - 3"
UPDATE public.jurnal SET jam_ke = '6-7' WHERE id = '6ppaepah4'; -- "Ekologi sosial" (KBM Budaya Melayu Riau 10:57-11:48)
