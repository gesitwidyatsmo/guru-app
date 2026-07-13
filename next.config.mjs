import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
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
