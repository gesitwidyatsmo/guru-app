import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  cacheOnFrontEndNav: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'supabase-api',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 Hari
        },
      },
      {
        urlPattern: /\/api\/.*/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'internal-api-cache',
          expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 Hari
        },
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
	/* config options here */
	compiler: {
		styledComponents: true,
	},
	turbopack: {},
	devIndicators: {
		appIsrStatus: false,
		buildActivity: false,
	},
};

export default withPWA(nextConfig);
