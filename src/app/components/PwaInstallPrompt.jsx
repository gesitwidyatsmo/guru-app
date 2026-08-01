'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Durasi dismiss dalam milidetik (30 hari)
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const DISMISS_KEY = 'pwa_install_dismissed_at';

/**
 * Mendeteksi apakah perangkat adalah iOS (iPhone/iPad/iPod)
 * Safari tidak mendukung event `beforeinstallprompt`, sehingga
 * diperlukan panduan manual khusus untuk pengguna iOS.
 */
function detectIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Mendeteksi apakah app sudah berjalan dalam mode standalone (sudah diinstall).
 * Jika sudah standalone, tidak perlu tampilkan prompt install.
 */
function isInStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  // 'android' | 'ios' | null — tipe prompt yang ditampilkan
  const [promptType, setPromptType] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // --- Cek kondisi awal ---

    // 1. Jika sudah diinstall sebagai standalone app, tidak perlu prompt
    if (isInStandaloneMode()) return;

    // 2. Cek apakah user sudah dismiss dalam 30 hari terakhir
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_DURATION_MS) {
        setIsDismissed(true);
        return; // Jangan pasang event listener jika sudah dismiss
      } else {
        // Sudah lewat 30 hari — hapus dan tampilkan lagi
        localStorage.removeItem(DISMISS_KEY);
      }
    }

    const isIOS = detectIOS();

    if (isIOS) {
      // iOS tidak mendukung `beforeinstallprompt`,
      // tampilkan panduan manual langsung
      setPromptType('ios');
    } else {
      // Android / Chrome / Edge: tunggu event beforeinstallprompt
      const handleBeforeInstallPrompt = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setPromptType('android');
      };

      const handleAppInstalled = () => {
        setPromptType(null);
        setDeferredPrompt(null);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  // Sembunyikan di halaman login dan admin
  if (pathname === '/login' || pathname?.startsWith('/admin')) {
    return null;
  }

  // Jangan render jika tidak ada prompt atau sudah di-dismiss
  if (!promptType || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Hasil instalasi: ${outcome}`);
    setDeferredPrompt(null);
    setPromptType(null);
  };

  const handleDismiss = () => {
    // Simpan timestamp dismiss — banner akan muncul lagi setelah 30 hari
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setIsDismissed(true);
  };

  return (
    <div
      className="fixed bottom-20 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:w-96 z-[110]"
      style={{ animation: 'pwaSlideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
    >
      <style>{`
        @keyframes pwaSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div className="neo-card-yellow p-4 flex flex-col gap-3 relative">
        {/* Tombol tutup */}
        <button
          onClick={handleDismiss}
          className="absolute -top-3 -right-3 bg-neo-white text-neo-black border-2 border-neo-black rounded-full w-8 h-8 flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_#0D0D0D] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_#0D0D0D] transition-all"
          aria-label="Tutup banner instalasi"
        >
          ✕
        </button>

        {/* Header: ikon + judul */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-neo-white border-2 border-neo-black rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-[2px_2px_0px_0px_#0D0D0D]">
            <img
              src="/android/launchericon-192x192.png"
              alt="Guru App Icon"
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">Install Guru App</h3>
            <p className="text-sm font-medium mt-0.5 opacity-80">
              {promptType === 'android'
                ? 'Akses lebih cepat & tampil penuh layar seperti app asli.'
                : 'Tambah ke Home Screen untuk akses instan.'}
            </p>
          </div>
        </div>

        {/* Konten berdasarkan platform */}
        {promptType === 'android' && (
          <button
            onClick={handleInstallClick}
            className="neo-btn-primary w-full py-2 mt-1 flex justify-center items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Install Sekarang
          </button>
        )}

        {promptType === 'ios' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Cara install di iPhone/iPad:</p>
            <ol className="flex flex-col gap-2">
              <li className="flex items-start gap-2 text-sm font-medium">
                <span className="bg-neo-black text-neo-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>
                  Ketuk ikon{' '}
                  <strong className="inline-flex items-center gap-1">
                    Bagikan
                    {/* Ikon Share iOS */}
                    <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </strong>{' '}
                  di bawah browser
                </span>
              </li>
              <li className="flex items-start gap-2 text-sm font-medium">
                <span className="bg-neo-black text-neo-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>Pilih <strong>"Tambahkan ke Layar Utama"</strong></span>
              </li>
              <li className="flex items-start gap-2 text-sm font-medium">
                <span className="bg-neo-black text-neo-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">3</span>
                <span>Ketuk <strong>"Tambahkan"</strong> di pojok kanan atas</span>
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
