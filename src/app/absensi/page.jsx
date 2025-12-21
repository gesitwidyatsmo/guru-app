/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

export default function AbsensiPage() {
  const router = useRouter();
  const [kelasList, setKelasList] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [siswaList, setSiswaList] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [absensi, setAbsensi] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Helper mapping warna → kelas Tailwind
  const getStatusClasses = (warna, active) => {
    const base = 'px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 shadow-sm';
    if (active) {
      switch (warna) {
        case 'green':
          return `${base} bg-gradient-to-br from-green-500 to-green-600 text-white ring-2 ring-green-400 ring-offset-2 scale-105`;
        case 'yellow':
          return `${base} bg-gradient-to-br from-yellow-400 to-yellow-500 text-white ring-2 ring-yellow-300 ring-offset-2 scale-105`;
        case 'blue':
          return `${base} bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 scale-105`;
        case 'red':
          return `${base} bg-gradient-to-br from-red-500 to-red-600 text-white ring-2 ring-red-400 ring-offset-2 scale-105`;
        case 'purple':
          return `${base} bg-gradient-to-br from-purple-500 to-purple-600 text-white ring-2 ring-purple-400 ring-offset-2 scale-105`;
        default:
          return `${base} bg-gradient-to-br from-indigo-500 to-indigo-600 text-white ring-2 ring-indigo-400 ring-offset-2 scale-105`;
      }
    }
    return `${base} bg-white text-gray-600 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-102`;
  };

  // Fetch data
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [resKelas, resStatus, resSiswa] = await Promise.all([
          fetch('/api/kelas'),
          fetch('/api/status-absensi'),
          fetch('/api/siswa'),
        ]);

        const dataKelas = resKelas.ok ? await resKelas.json() : [];
        const dataStatus = resStatus.ok ? await resStatus.json() : [];
        const dataSiswa = resSiswa.ok ? await resSiswa.json() : [];

        setKelasList(dataKelas);
        setStatusList(dataStatus);
        setSiswaList(dataSiswa.filter((s) => s.status === 'Aktif'));

        if (dataKelas.length > 0) {
          setSelectedKelas(dataKelas[0].kelas || dataKelas[0].nama_kelas);
        }
      } catch (err) {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memuat Data',
          text: err.message,
          confirmButtonColor: '#4F46E5',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const siswaKelasIni = siswaList.filter((s) => s.kelas === selectedKelas);

  // Inisialisasi absensi
  useEffect(() => {
    if (siswaKelasIni.length > 0 && statusList.length > 0) {
      const defaultStatus = statusList[0].label;
      const init = {};
      siswaKelasIni.forEach((s) => {
        init[s.id] = {
          status: absensi[s.id]?.status || defaultStatus,
          keterangan: absensi[s.id]?.keterangan || '',
        };
      });
      setAbsensi(init);
    }
  }, [selectedKelas, siswaList, statusList]);

  const handleStatusChange = (siswaId, labelStatus) => {
    setAbsensi((prev) => ({
      ...prev,
      [siswaId]: {
        ...(prev[siswaId] || { keterangan: '' }),
        status: labelStatus,
      },
    }));
  };

  const handleKeteranganChange = (siswaId, value) => {
    setAbsensi((prev) => ({
      ...prev,
      [siswaId]: {
        ...(prev[siswaId] || { status: statusList[0]?.label || '' }),
        keterangan: value,
      },
    }));
  };

  const handleTandaiSemua = (labelStatus) => {
    setAbsensi((prev) => {
      const updated = { ...prev };
      siswaKelasIni.forEach((s) => {
        updated[s.id] = {
          status: labelStatus,
          keterangan: prev[s.id]?.keterangan || '',
        };
      });
      return updated;
    });
  };

  const handleSimpan = async () => {
    const result = await Swal.fire({
      title: 'Simpan Absensi?',
      text: `Menyimpan absensi untuk ${siswaKelasIni.length} siswa`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4F46E5',
      cancelButtonColor: '#6B7280',
      confirmButtonText: 'Ya, Simpan',
      cancelButtonText: 'Batal',
    });

    if (!result.isConfirmed) return;

    setSaving(true);

    const payload = siswaKelasIni.map((s) => ({
      tanggal,
      kelas: selectedKelas,
      siswa_id: s.id,
      status: absensi[s.id]?.status || '',
      keterangan: absensi[s.id]?.keterangan || '',
    }));

    try {
      const res = await fetch('/api/absensi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          text: `Absensi ${siswaKelasIni.length} siswa tersimpan`,
          confirmButtonColor: '#4F46E5',
          timer: 2000,
          timerProgressBar: true,
        });
      } else {
        throw new Error('Gagal menyimpan absensi');
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: error.message,
        confirmButtonColor: '#4F46E5',
      });
    } finally {
      setSaving(false);
    }
  };

  // Hitung statistik
  const stats = {
    total: siswaKelasIni.length,
    hadir: Object.values(absensi).filter((a) => a.status === 'Hadir').length,
    sakit: Object.values(absensi).filter((a) => a.status === 'Sakit').length,
    izin: Object.values(absensi).filter((a) => a.status === 'Izin').length,
    alpha: Object.values(absensi).filter((a) => a.status === 'Alpha').length,
  };

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-16 w-16 border-4 border-indigo-500 border-t-transparent mx-auto mb-4'></div>
          <p className='text-gray-600 font-medium'>Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6'>
        {/* Header */}
        <div className='bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-3xl shadow-2xl p-6 sm:p-8 mb-6 text-white'>
          <div className='flex items-center justify-between mb-4'>
            <button
              onClick={() => router.back()}
              className='bg-white/20 backdrop-blur-sm hover:bg-white/30 p-2 rounded-xl transition-all'>
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
              </svg>
            </button>
            <h1 className='text-2xl sm:text-3xl font-bold'>📋 Absensi Siswa</h1>
            <div className='w-10'></div>
          </div>

          {/* Filter Section */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-white/90 mb-2'>Pilih Kelas</label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className='w-full px-4 py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'>
                {kelasList.map((k) => (
                  <option key={k.id} value={k.kelas || k.nama_kelas}>
                    {k.kelas || k.nama_kelas}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-white/90 mb-2'>Tanggal</label>
              <input
                type='date'
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className='w-full px-4 py-3 rounded-xl bg-white/90 backdrop-blur-sm text-gray-800 font-semibold border-2 border-white/50 focus:ring-2 focus:ring-white focus:border-white outline-none transition-all'
              />
            </div>
          </div>
        </div>

        {/* Statistik */}
        <div className='grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-6'>
          <div className='bg-white rounded-2xl shadow-lg p-4 border-2 border-gray-100 hover:shadow-xl transition-all'>
            <div className='text-center'>
              <p className='text-xs sm:text-sm text-gray-600 mb-1'>Total Siswa</p>
              <p className='text-2xl sm:text-3xl font-bold text-gray-800'>{stats.total}</p>
            </div>
          </div>
          <div className='bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
            <div className='text-center'>
              <p className='text-xs sm:text-sm text-white/90 mb-1'>Hadir</p>
              <p className='text-2xl sm:text-3xl font-bold'>{stats.hadir}</p>
            </div>
          </div>
          <div className='bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
            <div className='text-center'>
              <p className='text-xs sm:text-sm text-white/90 mb-1'>Sakit</p>
              <p className='text-2xl sm:text-3xl font-bold'>{stats.sakit}</p>
            </div>
          </div>
          <div className='bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
            <div className='text-center'>
              <p className='text-xs sm:text-sm text-white/90 mb-1'>Izin</p>
              <p className='text-2xl sm:text-3xl font-bold'>{stats.izin}</p>
            </div>
          </div>
          <div className='bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-lg p-4 text-white hover:shadow-xl transition-all'>
            <div className='text-center'>
              <p className='text-xs sm:text-sm text-white/90 mb-1'>Alpha</p>
              <p className='text-2xl sm:text-3xl font-bold'>{stats.alpha}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className='bg-white rounded-2xl shadow-lg p-4 sm:p-6 mb-6 border-2 border-gray-100'>
          <h3 className='text-sm font-semibold text-gray-700 mb-3'>Tandai Semua Sebagai:</h3>
          <div className='flex flex-wrap gap-2'>
            {statusList.map((st) => (
              <button
                key={st.id}
                onClick={() => handleTandaiSemua(st.label)}
                className={`${getStatusClasses(st.warna, false)} hover:scale-105`}>
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Daftar Siswa */}
        <div className='bg-white rounded-2xl shadow-xl border-2 border-gray-100 overflow-hidden'>
          <div className='p-4 sm:p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200'>
            <h2 className='text-xl font-bold text-gray-800'>
              Daftar Siswa ({siswaKelasIni.length})
            </h2>
          </div>

          <div className='divide-y-2 divide-gray-100'>
            {siswaKelasIni.map((siswa, index) => (
              <div
                key={siswa.id}
                className='p-4 sm:p-6 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 transition-all'>
                {/* Mobile Layout */}
                <div className='block lg:hidden'>
                  <div className='flex items-start gap-3 mb-4'>
                    <div className='bg-indigo-100 text-indigo-600 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0'>
                      {index + 1}
                    </div>
                    <div className='flex-1'>
                      <h3 className='font-bold text-gray-800 text-base mb-1'>
                        {siswa.nama_lengkap}
                      </h3>
                      {siswa.nis && (
                        <p className='text-xs text-gray-500'>NIS: {siswa.nis}</p>
                      )}
                    </div>
                  </div>

                  {/* Status Buttons */}
                  <div className='grid grid-cols-2 gap-2 mb-3'>
                    {statusList.map((st) => {
                      const active = absensi[siswa.id]?.status === st.label;
                      return (
                        <button
                          key={st.id}
                          onClick={() => handleStatusChange(siswa.id, st.label)}
                          className={getStatusClasses(st.warna, active)}>
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Keterangan */}
                  <input
                    type='text'
                    placeholder='Keterangan (opsional)'
                    value={absensi[siswa.id]?.keterangan || ''}
                    onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
                    className='w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm'
                  />
                </div>

                {/* Desktop Layout */}
                <div className='hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center'>
                  {/* No & Nama */}
                  <div className='col-span-3 flex items-center gap-3'>
                    <div className='bg-indigo-100 text-indigo-600 font-bold rounded-full w-10 h-10 flex items-center justify-center flex-shrink-0'>
                      {index + 1}
                    </div>
                    <div>
                      <h3 className='font-bold text-gray-800 text-sm'>
                        {siswa.nama_lengkap}
                      </h3>
                      {siswa.nis && (
                        <p className='text-xs text-gray-500'>NIS: {siswa.nis}</p>
                      )}
                    </div>
                  </div>

                  {/* Status Buttons */}
                  <div className='col-span-6 flex gap-2'>
                    {statusList.map((st) => {
                      const active = absensi[siswa.id]?.status === st.label;
                      return (
                        <button
                          key={st.id}
                          onClick={() => handleStatusChange(siswa.id, st.label)}
                          className={getStatusClasses(st.warna, active)}>
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Keterangan */}
                  <div className='col-span-3'>
                    <input
                      type='text'
                      placeholder='Keterangan'
                      value={absensi[siswa.id]?.keterangan || ''}
                      onChange={(e) => handleKeteranganChange(siswa.id, e.target.value)}
                      className='w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm'
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tombol Simpan */}
        <div className='mt-6 flex gap-3'>
          <button
            onClick={() => router.back()}
            className='flex-1 sm:flex-none px-8 py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all shadow-lg'>
            Batal
          </button>
          <button
            onClick={handleSimpan}
            disabled={saving}
            className='flex-1 sm:flex-auto px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-bold hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-105'>
            {saving ? 'Menyimpan...' : '💾 Simpan Absensi'}
          </button>
        </div>
      </div>
    </div>
  );
}