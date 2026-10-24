import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';
import StyledComponentsRegistry from '@/lib/registry';
import IdleTimerWrapper from './components/IdleTimerWrapper';
import KbmBlocker from './components/KbmBlocker';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { AcademicProvider } from '@/context/AcademicContext';
import { getSchoolBranding } from '@/lib/schoolBranding';

const plusJakartaSans = Plus_Jakarta_Sans({
	variable: '--font-plus-jakarta-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export async function generateMetadata() {
	const branding = await getSchoolBranding();
	const hasSetting = !!(branding?.logo || branding?.nama);
	const appTitle = hasSetting ? 'SMP IT TBI 4' : 'Guru App';

	return {
		title: {
			default: appTitle,
			template: `%s | ${appTitle}`,
		},
		description: 'Aplikasi manajemen KBM dan Jurnal Mengajar untuk Guru',
		manifest: '/manifest.json',
		icons: {
			icon: [
				{ url: '/api/app-icon', sizes: 'any' },
				{ url: '/api/app-icon', type: 'image/png' },
			],
			apple: [
				{ url: '/api/app-icon', sizes: '180x180', type: 'image/png' },
			],
			shortcut: '/api/app-icon',
		},
		appleWebApp: {
			capable: true,
			statusBarStyle: 'black-translucent',
			title: appTitle,
			startupImage: [
				{ url: '/ios/1024.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
				{ url: '/ios/1024.png', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
				{ url: '/ios/512.png', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
				{ url: '/ios/1024.png', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' },
			],
		},
	};
}

export const viewport = {
	themeColor: '#E8451A',
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
};

export default function RootLayout({ children }) {
	return (
		<html lang='id'>
			<head>
				<link rel='icon' href='/api/app-icon' sizes='any' />
				<link rel='apple-touch-icon' href='/api/app-icon' />
			</head>
			<body className={`${plusJakartaSans.variable} ${geistMono.variable} antialiased`}>
				<AcademicProvider>
					<IdleTimerWrapper>
						<StyledComponentsRegistry>
							{children}
							<KbmBlocker />
							<PwaInstallPrompt />
						</StyledComponentsRegistry>
					</IdleTimerWrapper>
				</AcademicProvider>
			</body>
		</html>
	);
}
