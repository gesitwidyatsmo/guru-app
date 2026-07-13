import { Plus_Jakarta_Sans, Geist_Mono } from 'next/font/google';
import './globals.css';
import StyledComponentsRegistry from '@/lib/registry';
import IdleTimerWrapper from './components/IdleTimerWrapper';
import KbmBlocker from './components/KbmBlocker';

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
	description: 'Aplikasi yang memfasilitasi pembelajaran untuk guru',
	manifest: '/manifest.json',
};

export const viewport = {
	themeColor: '#4f46e5',
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
};

export default function RootLayout({ children }) {
	return (
		<html lang='en'>
			<body className={`${plusJakartaSans.variable} ${geistMono.variable} antialiased`}>
				<IdleTimerWrapper>
					<StyledComponentsRegistry>
						{children}
						<KbmBlocker />
					</StyledComponentsRegistry>
				</IdleTimerWrapper>
			</body>
		</html>
	);
}
