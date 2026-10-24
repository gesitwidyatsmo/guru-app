import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';
import { extractTingkat } from '@/utils/erapor';
import {
	convertMapelScoreToEkskul,
	getDefaultNarasiEkskul,
	getOfficialEkskulName,
	isEkskulApplicableForTingkat,
	isMatchingEkskulMapel,
} from '@/lib/eraporEkskulUtils';

async function getAuthInfo(request, supabase) {
	const cookieStore = await cookies();
	let role = request.headers.get('x-user-role') || cookieStore.get('user_role')?.value;
	let userId = request.headers.get('x-user-id') || cookieStore.get('user_id')?.value;

	if (!role || !userId) {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: userProfile } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('auth_id', user.id)
				.maybeSingle();
			if (userProfile) {
				role = role || userProfile.role;
				userId = userId || userProfile.id_user;
			}
		}
	}

	if (!userId) {
		const rawName = request.headers.get('x-user-name') || cookieStore.get('user_name')?.value;
		if (rawName) {
			const userName = decodeURIComponent(rawName);
			const { data: u } = await supabaseAdmin
				.from('users')
				.select('id_user, role')
				.eq('nama_lengkap', userName)
				.maybeSingle();
			if (u) {
				userId = u.id_user;
				role = role || u.role;
			}
		}
	}

	return { role, userId };
}

export async function GET(request) {
	try {
		const supabase = supabaseAdmin || (await createClient());
		const { role, userId } = await getAuthInfo(request, supabase);

		const { searchParams } = new URL(request.url);
		const siswaId = searchParams.get('siswa_id');
		const kelasId = searchParams.get('kelas_id');
		const semester = parseInt(searchParams.get('semester') || '1', 10);
		const tahunAjaran = searchParams.get('tahun_ajaran');

		if (!siswaId && !kelasId) {
			return NextResponse.json({ error: 'siswa_id atau kelas_id wajib disertakan' }, { status: 400 });
		}

		// Validasi Wali Kelas jika role Guru
		if (role === 'Guru' && userId) {
			if (kelasId) {
				const { data: kls } = await supabase.from('kelas').select('id, id_wali_kelas, wali_kelas').eq('id', kelasId).maybeSingle();
				const isDirectWali = kls?.id_wali_kelas === userId;
				let isRelasiWali = false;
				if (!isDirectWali) {
					const { data: relasi } = await supabase
						.from('wali_kelas')
						.select('id')
						.eq('user_id', userId)
						.eq('id_kelas', kelasId)
						.eq('is_active', true)
						.maybeSingle();
					if (relasi) isRelasiWali = true;
				}
				let isNameWali = false;
				if (!isDirectWali && !isRelasiWali && kls?.wali_kelas) {
					const { data: userRow } = await supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle();
					if (userRow?.nama_lengkap && kls.wali_kelas.includes(userRow.nama_lengkap)) {
						isNameWali = true;
					}
				}
				if (!isDirectWali && !isRelasiWali && !isNameWali) {
					return NextResponse.json(
						{ error: 'Akses Ditolak: Hanya Wali Kelas atau Administrator yang dapat mencetak rapor rombel ini.' },
						{ status: 403 }
					);
				}
			} else if (siswaId) {
				const { data: sData } = await supabase.from('siswa').select('kelas').eq('id', siswaId).maybeSingle();
				if (sData) {
					const { data: kls } = await supabase.from('kelas').select('id, id_wali_kelas, wali_kelas').eq('nama_kelas', sData.kelas).maybeSingle();
					const isDirectWali = kls?.id_wali_kelas === userId;
					let isRelasiWali = false;
					if (!isDirectWali && kls) {
						const { data: relasi } = await supabase
							.from('wali_kelas')
							.select('id')
							.eq('user_id', userId)
							.eq('id_kelas', kls.id)
							.eq('is_active', true)
							.maybeSingle();
						if (relasi) isRelasiWali = true;
					}
					let isNameWali = false;
					if (!isDirectWali && !isRelasiWali && kls?.wali_kelas) {
						const { data: userRow } = await supabaseAdmin.from('users').select('nama_lengkap').eq('id_user', userId).maybeSingle();
						if (userRow?.nama_lengkap && kls.wali_kelas.includes(userRow.nama_lengkap)) {
							isNameWali = true;
						}
					}
					if (!isDirectWali && !isRelasiWali && !isNameWali) {
						return NextResponse.json(
							{ error: 'Akses Ditolak: Hanya Wali Kelas atau Administrator yang dapat mencetak rapor siswa ini.' },
							{ status: 403 }
						);
					}
				}
			}
		}

		// 1. Ambil Profil Sekolah dari app_settings & rapor_pengaturan
		const [settingRow, raporPengaturanRow, extraSettingsRow] = await Promise.all([
			supabase.from('app_settings').select('value').eq('key', 'profil_sekolah').maybeSingle(),
			supabase.from('rapor_pengaturan').select('*').limit(1).maybeSingle(),
			supabase.from('app_settings').select('value').eq('key', 'rapor_settings').maybeSingle(),
		]);

		const profil = settingRow.data?.value || {};
		const setRapor = raporPengaturanRow.data || {};
		const extraSet = extraSettingsRow.data?.value || {};

		const namaSekolah = profil.nama_sekolah || 'SMP IT TEBUIRENG 4 AL-ISHLAH';
		const alamatSekolah =
			setRapor.alamat_sekolah ||
			extraSet.alamat_sekolah ||
			profil.alamat ||
			'Sekretariat Jl. Perintis Desa Kuala Gading, Batang Cenaku, Indragiri Hulu, Riau Kode Pos 29355';
		const kepsekNama = setRapor.nama_kepsek || extraSet.nama_kepsek || profil.nama_kepsek || 'Mujib Kodar, S.Pd,I';
		const kepsekNip = setRapor.nip_kepsek || extraSet.nip_kepsek || profil.nip_kepsek || '-';

		// Ambil Pengaturan Titimangsa Rapor (Dinamis Sesuai Semester & Tahun Ajaran)
		const formatIndoDate = (dateObj) => {
			if (!dateObj || isNaN(dateObj.getTime())) return '';
			const months = [
				'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
				'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
			];
			return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
		};

		const tempatRapor = setRapor.tempat_rapor || extraSet.tempat_rapor || profil.kota_kabupaten || 'Kuala Gading';
		let tanggalRapor = '';
		let isTitimangsaOfficial = false;

		// 1. Cek dari rapor_pengaturan (Pengesahan resmi dari Waka Kurikulum)
		if (semester === 2) {
			const rawDateGenap = setRapor.tanggal_rapor_genap || extraSet.tanggal_rapor_genap;
			if (rawDateGenap && String(rawDateGenap).trim()) {
				tanggalRapor = String(rawDateGenap).trim();
				isTitimangsaOfficial = true;
			}
		} else {
			const rawDateGanjil = setRapor.tanggal_rapor_ganjil || setRapor.tanggal_rapor || extraSet.tanggal_rapor_ganjil;
			if (rawDateGanjil && String(rawDateGanjil).trim()) {
				tanggalRapor = String(rawDateGanjil).trim();
				isTitimangsaOfficial = true;
			}
		}

		// 2. Jika belum disahkan di rapor_pengaturan, hitung secara dinamis dan aman
		if (!tanggalRapor) {
			// Coba ambil dari tanggal_selesai pada tabel tahun_ajar
			let taRow = null;
			if (tahunAjaran) {
				const { data } = await supabase
					.from('tahun_ajar')
					.select('tanggal_selesai, nama, semester')
					.eq('nama', tahunAjaran)
					.eq('semester', semester)
					.maybeSingle();
				taRow = data;
			}
			if (!taRow) {
				const { data } = await supabase
					.from('tahun_ajar')
					.select('tanggal_selesai, nama, semester')
					.eq('is_aktif', true)
					.maybeSingle();
				taRow = data;
			}

			if (taRow?.tanggal_selesai) {
				const d = new Date(taRow.tanggal_selesai);
				if (!isNaN(d.getTime())) {
					tanggalRapor = formatIndoDate(d);
				}
			}

			// 3. Fallback dinamis: ekstrak tahun dari string tahunAjaran (contoh '2026/2027')
			if (!tanggalRapor) {
				const rawYearStr = String(tahunAjaran || taRow?.nama || '2026/2027');
				const yearParts = rawYearStr.split('/').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
				const year1 = yearParts[0] || new Date().getFullYear();
				const year2 = yearParts[1] || year1 + 1;

				if (semester === 2) {
					tanggalRapor = `26 Juni ${year2}`;
				} else {
					tanggalRapor = `20 Desember ${year1}`;
				}
			}
		}

		// 2. Ambil Siswa yang diminta
		let siswaQuery = supabase.from('siswa').select('*');
		if (siswaId) {
			siswaQuery = siswaQuery.eq('id', siswaId);
		} else if (kelasId) {
			const { data: kData } = await supabase.from('kelas').select('nama_kelas').eq('id', kelasId).single();
			if (kData) siswaQuery = siswaQuery.eq('kelas', kData.nama_kelas).eq('status', 'Aktif');
		}

		const { data: siswaList, error: siswaErr } = await siswaQuery.order('nama_lengkap', { ascending: true });
		if (siswaErr) throw siswaErr;

		if (!siswaList || siswaList.length === 0) {
			return NextResponse.json({ error: 'Data siswa tidak ditemukan' }, { status: 404 });
		}

		// 3. Ambil data Kelas & Wali Kelas
		const kelasNames = [...new Set(siswaList.map((s) => s.kelas).filter(Boolean))];
		const { data: kelasList } = await supabase
			.from('kelas')
			.select('*, wali:id_wali_kelas(id_user, nama_lengkap, nip)')
			.in('nama_kelas', kelasNames);

		const kelasMap = {};
		(kelasList || []).forEach((k) => {
			kelasMap[k.nama_kelas] = k;
		});

		// 4. Ambil Daftar Mata Pelajaran Intrakurikuler (Kelompok A & B, mengecualikan Ekskul)
		const [{ data: mapelList }, { data: ekskulMapels }] = await Promise.all([
			supabase
				.from('mapel')
				.select('id, mapel, nama_resmi, kelompok, urutan')
				.neq('kelompok', 'Ekskul')
				.not('id', 'in', '("MP-ASW","MP-KHOT")')
				.order('kelompok', { ascending: true })
				.order('urutan', { ascending: true })
				.order('mapel', { ascending: true }),
			supabase
				.from('mapel')
				.select('id, mapel, nama_resmi, kelompok, tingkat')
				.or('kelompok.eq.Ekskul,id.in.("MP-ASW","MP-KHOT")'),
		]);

		const siswaIds = siswaList.map((s) => s.id);

		// 5. Ambil Seluruh Data Nilai Kuantitatif, Kualitatif, Ekskul, Presensi
		const [nkRes, nklRes, eksRes, absRes] = await Promise.all([
			supabase
				.from('rapor_nilai_kuantitatif')
				.select('*')
				.in('siswa_id', siswaIds)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran),
			supabase
				.from('rapor_nilai_kualitatif')
				.select('*')
				.in('siswa_id', siswaIds)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran),
			supabase
				.from('rapor_ekstrakurikuler')
				.select('*')
				.in('siswa_id', siswaIds)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran),
			supabase
				.from('rapor_ketidakhadiran')
				.select('*')
				.in('siswa_id', siswaIds)
				.eq('semester', semester)
				.eq('tahun_ajaran', tahunAjaran),
		]);

		const nkData = nkRes.data || [];
		const nklData = nklRes.data || [];
		const eksData = eksRes.data || [];
		const absData = absRes.data || [];

		// Map Nilai Kuantitatif: { [siswa_id]: { [mapel_id]: nilai_akhir } }
		const kuantitatifMap = {};
		nkData.forEach((row) => {
			if (!kuantitatifMap[row.siswa_id]) kuantitatifMap[row.siswa_id] = {};
			kuantitatifMap[row.siswa_id][row.mapel_id] = row.nilai_akhir;
		});

		// Map Nilai Kualitatif: { [siswa_id]: { [mapel_id]: { deskripsi_tertinggi, deskripsi_terendah } } }
		const kualitatifMap = {};
		nklData.forEach((row) => {
			if (!kualitatifMap[row.siswa_id]) kualitatifMap[row.siswa_id] = {};
			kualitatifMap[row.siswa_id][row.mapel_id] = {
				deskripsi_tertinggi: row.deskripsi_tertinggi || '',
				deskripsi_terendah: row.deskripsi_terendah || '',
			};
		});

		// Map Ekskul: { [siswa_id]: [...] }
		const ekskulMap = {};
		eksData.forEach((row) => {
			if (!ekskulMap[row.siswa_id]) ekskulMap[row.siswa_id] = [];
			const eName = row.nama_ekskul || row.nama_kegiatan || '-';
			ekskulMap[row.siswa_id].push({
				nama_ekskul: eName,
				nama_kegiatan: eName,
				predikat: row.predikat || 'Baik',
				keterangan: row.keterangan || '-',
			});
		});

		// Map Presensi: { [siswa_id]: { sakit, izin, tanpa_keterangan, alpa, catatan_wali_kelas, catatan } }
		const absensiMap = {};
		absData.forEach((row) => {
			const s = row.sakit || 0;
			const i = row.izin || 0;
			const a = row.tanpa_keterangan ?? row.alpa ?? 0;
			const c = row.catatan_wali_kelas || row.catatan || '';
			absensiMap[row.siswa_id] = {
				sakit: s,
				izin: i,
				tanpa_keterangan: a,
				alpa: a,
				catatan_wali_kelas: c,
				catatan: c,
			};
		});

		// Ambil data jadwal & KBM untuk mengetahui mapel aktif per kelas
		const [jadwalKlsRes, kbmKlsRes] = await Promise.all([
			supabase.from('jadwal').select('kelas, mapel').in('kelas', kelasNames),
			supabase.from('guru_kbm').select('kelas, mapel').in('kelas', kelasNames),
		]);

		const classMapelMap = {};
		kelasNames.forEach((kName) => {
			classMapelMap[kName] = new Set([
				...(jadwalKlsRes.data || []).filter((j) => j.kelas === kName).map((j) => j.mapel).filter(Boolean),
				...(kbmKlsRes.data || []).filter((k) => k.kelas === kName).map((k) => k.mapel).filter(Boolean),
			]);
		});

		// 6. Bundel Data Siswa Lengkap yang kompatibel dengan komponen cetak
		const students = siswaList.map((siswa) => {
			const kelasInfo = kelasMap[siswa.kelas] || {};
			const sNilaiKuantitatif = kuantitatifMap[siswa.id] || {};
			const sNilaiKualitatif = kualitatifMap[siswa.id] || {};

			const waliNama = kelasInfo.wali?.nama_lengkap || kelasInfo.wali_kelas || 'Wali Kelas';
			const waliNip = kelasInfo.wali?.nip || '-';

			const activeClassMapels = classMapelMap[siswa.kelas] || new Set();
			const classSpecificMapels = (mapelList || []).filter((m) => {
				if (m.id === 'MP-ASW' || m.id === 'MP-KHOT' || m.kelompok === 'Ekskul') return false;
				if (activeClassMapels.size === 0) return true;
				return (
					activeClassMapels.has(m.mapel) ||
					activeClassMapels.has(m.nama_resmi) ||
					sNilaiKuantitatif[m.id] !== undefined ||
					sNilaiKualitatif[m.id] !== undefined
				);
			});

			// Struktur tabel nilai per mapel
			const mapelScores = classSpecificMapels.map((m, idx) => {
				const nKuan = sNilaiKuantitatif[m.id];
				const nKual = sNilaiKualitatif[m.id] || {};

				let capaian = '-';
				if (nKual.deskripsi_tertinggi && nKual.deskripsi_terendah) {
					capaian = `${nKual.deskripsi_tertinggi} Namun ${nKual.deskripsi_terendah.toLowerCase()}`;
				} else if (nKual.deskripsi_tertinggi) {
					capaian = nKual.deskripsi_tertinggi;
				} else if (nKual.deskripsi_terendah) {
					capaian = nKual.deskripsi_terendah;
				}

				return {
					id: m.id,
					mapel_id: m.id,
					no: idx + 1,
					nama: m.nama_resmi || m.mapel,
					nama_mapel: m.nama_resmi || m.mapel,
					kelompok: m.kelompok || 'A',
					nilai: nKuan !== undefined ? nKuan : '-',
					nilai_akhir: nKuan !== undefined ? nKuan : '-',
					capaian,
					capaian_tertinggi: nKual.deskripsi_tertinggi || '-',
					capaian_terendah: nKual.deskripsi_terendah || '-',
				};
			});

			return {
				siswa: {
					...siswa,
					id: siswa.id,
					nama_lengkap: siswa.nama_lengkap,
					nis: siswa.nis || '-',
					nisn: siswa.nisn || '-',
					kelas: siswa.kelas,
				},
				kelas: {
					nama_kelas: siswa.kelas,
					fase: 'D',
					wali_nama: waliNama,
					wali_nip: waliNip,
				},
				mapel_scores: mapelScores,
				ekstrakurikuler: (() => {
					const tingkatSiswa = extractTingkat(siswa.kelas);
					const userEkskuls = [...(ekskulMap[siswa.id] || [])].filter((e) => {
						const eName = e.nama_ekskul || e.nama_kegiatan || '';
						return isEkskulApplicableForTingkat(eName, tingkatSiswa);
					});

					// Sinkronkan otomatis dari seluruh mapel berkategori Ekskul (Opsi A)
					(ekskulMapels || []).forEach((em) => {
						if (!isEkskulApplicableForTingkat(em, tingkatSiswa)) return;
						const emName = em.nama_resmi || getOfficialEkskulName(em.id, em);

						const existingIdx = userEkskuls.findIndex((e) => {
							const name = e.nama_ekskul || e.nama_kegiatan || '';
							return isMatchingEkskulMapel(name, em);
						});

						const numScore = sNilaiKuantitatif[em.id];
						const descText = sNilaiKualitatif[em.id]?.deskripsi_tertinggi || '';
						const hasScore = numScore !== undefined && numScore !== null && numScore !== '' && !isNaN(numScore);
						const syncedItem = hasScore
							? convertMapelScoreToEkskul(em.id, numScore, descText)
							: {
									nama_ekskul: emName,
									nama_kegiatan: emName,
									predikat: '-',
									keterangan: '-',
									nilai_angka: null,
							  };

						if (existingIdx !== -1) {
							// Selalu utamakan nilai & narasi murni dari Guru Mapel
							userEkskuls[existingIdx] = {
								...userEkskuls[existingIdx],
								nama_ekskul: emName,
								nama_kegiatan: emName,
								predikat: syncedItem.predikat,
								keterangan: syncedItem.keterangan,
								nilai_angka: syncedItem.nilai_angka,
							};
						} else {
							userEkskuls.push(syncedItem);
						}
					});

					const hasPramuka = userEkskuls.some((e) =>
						(e.nama_ekskul || e.nama_kegiatan || '').toLowerCase().includes('pramuka')
					);
					if (!hasPramuka) {
						userEkskuls.unshift({
							nama_ekskul: 'Praja Muda Karana (Pramuka)',
							nama_kegiatan: 'Praja Muda Karana (Pramuka)',
							predikat: '-',
							keterangan: '-',
						});
					}
					return userEkskuls;
				})(),
				ketidakhadiran: absensiMap[siswa.id] || {
					sakit: 0,
					izin: 0,
					tanpa_keterangan: 0,
					alpa: 0,
					catatan_wali_kelas: '',
					catatan: '',
				},
				// Alias untuk fleksibilitas pemanggilan:
				identitas_siswa: {
					...siswa,
					id: siswa.id,
					nama: siswa.nama_lengkap,
					nis: siswa.nis || '-',
					nisn: siswa.nisn || '-',
					kelas: siswa.kelas,
					fase: 'D',
					semester,
					tahun_ajaran: tahunAjaran,
				},
				nilai_akademik: mapelScores,
			};
		});

		return NextResponse.json({
			total_siswa: students.length,
			students,
			data: students,
			sekolah: {
				nama_sekolah: namaSekolah,
				npsn: profil.npsn || '69953165',
				nis_nss_nds: profil.nis_nss_nds || setRapor.nis_nss_nds || '-',
				alamat: alamatSekolah,
				kelurahan_desa: profil.kelurahan_desa || 'Kuala Gading',
				kecamatan: profil.kecamatan || 'Batang Cenaku',
				kota_kabupaten: profil.kota_kabupaten || 'Indragiri Hulu',
				provinsi: profil.provinsi || 'Riau',
				website: profil.website || 'www.tebuireng4.com',
				email: profil.email || 'tebuireng4_alishlah@yahoo.com',
				telepon: profil.telepon || '082131028161',
				kementerian: profil.kementerian || 'KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH',
				tempat_rapor: tempatRapor,
				tanggal_rapor: tanggalRapor,
				is_titimangsa_official: isTitimangsaOfficial,
				nama_kepsek: kepsekNama,
				kepsek: kepsekNama,
				nip_kepsek: kepsekNip,
				logo_kiri: profil.logo_kiri || '/logo smp.png',
			},
			semester_label: semester === 1 ? '1 (Ganjil)' : '2 (Genap)',
		});
	} catch (error) {
		console.error('Error GET rapor_cetak:', error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
