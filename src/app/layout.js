import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';
import StyledComponentsRegistry from '@/lib/registry';
import IdleTimerWrapper from './components/IdleTimerWrapper';
import KbmBlocker from './components/KbmBlocker';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { AcademicProvider } from '@/context/AcademicContext';

const plusJakartaSans = Plus_Jakarta_Sans({
	variable: '--font-plus-jakarta-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata = {
	title: 'Guru App',
	description: 'Aplikasi manajemen KBM dan Jurnal Mengajar untuk Guru',
	manifest: '/manifest.json',
	appleWebApp: {
		capable: true,
		statusBarStyle: 'black-translucent',
		title: 'Guru App',
		// Startup images untuk layar putih flash di iOS saat launch
		startupImage: [
			// iPhone 14 Pro Max
			{ url: '/ios/1024.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
			// iPhone 14 Pro
			{ url: '/ios/1024.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
			// iPhone SE / 8 / 7 / 6
			{ url: '/ios/512.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
			// iPad Pro 12.9
			{ url: '/ios/1024.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' },
		],
	},
	icons: {
		apple: [
			{ url: '/ios/180.png', sizes: '180x180' },
			{ url: '/ios/152.png', sizes: '152x152' },
			{ url: '/ios/167.png', sizes: '167x167' },
		],
	},
};

export const viewport = {
	themeColor: '#E8451A',
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
};

import OfflineSyncIndicator from './components/OfflineSyncIndicator';

export default function RootLayout({ children }) {
	return (
		<html lang='id'>
			<body className={`${plusJakartaSans.variable} ${geistMono.variable} antialiased`}>
				<AcademicProvider>
					<IdleTimerWrapper>
						<StyledComponentsRegistry>
							{children}
							<OfflineSyncIndicator />
							<KbmBlocker />
							<PwaInstallPrompt />
						</StyledComponentsRegistry>
					</IdleTimerWrapper>
				</AcademicProvider>
			</body>
		</html>
	);
}
