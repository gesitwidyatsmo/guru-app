import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // SW hanya aktif di production — ini BENAR sesuai standar PWA.
  // Untuk test PWA: jalankan `npm run build && npm run start`
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  // Auto-reload halaman saat koneksi kembali dari offline
  reloadOnOnline: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // Navigasi halaman: NetworkFirst agar selalu fresh, fallback ke cache
        urlPattern: /^\/(?!api\/).*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-cache',
          networkTimeoutSeconds: 10,
          expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }, // 1 Hari
        },
      },
      {
        // Supabase API: StaleWhileRevalidate untuk data yang bisa sedikit basi
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'supabase-api',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 Hari
        },
      },
      {
        // Internal API: NetworkFirst agar data selalu terkini
        urlPattern: /\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'internal-api-cache',
          networkTimeoutSeconds: 5,
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 1 Hari
        },
      },
      {
        // Aset statis: CacheFirst karena tidak berubah antar deploy
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 Hari
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	compiler: {
		styledComponents: true,
	},
	// CATATAN: `turbopack: {}` DIHAPUS — Turbopack tidak mendukung webpack plugins,
	// dan @ducanh2912/next-pwa bekerja via Workbox (webpack plugin).
	// Turbopack tetap aktif di `npm run dev` via CLI flag, ini tidak berpengaruh ke production build.
	devIndicators: {
		appIsrStatus: false,
		buildActivity: false,
	},
};

export default withPWA(nextConfig);
