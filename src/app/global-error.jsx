'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, Home, Trash2 } from 'lucide-react';

export default function GlobalError({ error, reset }) {
	const [isClearing, setIsClearing] = useState(false);

	useEffect(() => {
		console.error('Fatal Global Error (Root Layout Crash):', error);
	}, [error]);

	const handleReload = () => {
		if (typeof reset === 'function') {
			try {
				reset();
				return;
			} catch {
				// Fallback
			}
		}
		window.location.reload();
	};

	const handleClearAndReload = async () => {
		setIsClearing(true);
		try {
			if (typeof window !== 'undefined') {
				if ('caches' in window) {
					const names = await caches.keys();
					await Promise.all(names.map((n) => caches.delete(n)));
				}
				sessionStorage.clear();
				localStorage.clear();
			}
		} catch (e) {
			console.warn('Gagal membersihkan cache:', e);
		}
		window.location.href = '/?reset=' + Date.now();
	};

	return (
		<html lang='id'>
			<head>
				<title>Aplikasi Mengalami Kendala | Guru App</title>
				<meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1' />
				<style>{`
					* { box-sizing: border-box; margin: 0; padding: 0; }
					body {
						font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
						background-color: #FFF5F0;
						color: #0D0D0D;
						display: flex;
						min-height: 100vh;
						align-items: center;
						justify-content: center;
						padding: 16px;
					}
					.card {
						background: #ffffff;
						border: 3px solid #0D0D0D;
						border-radius: 16px;
						box-shadow: 8px 8px 0px 0px #0D0D0D;
						max-width: 540px;
						width: 100%;
						padding: 24px;
					}
					.badge {
						display: inline-block;
						background: #FEE2E2;
						color: #DC2626;
						border: 2px solid #0D0D0D;
						box-shadow: 2px 2px 0px 0px #0D0D0D;
						border-radius: 6px;
						padding: 2px 8px;
						font-size: 11px;
						font-weight: 900;
						text-transform: uppercase;
						margin-bottom: 8px;
					}
					.title {
						font-size: 20px;
						font-weight: 900;
						text-transform: uppercase;
						line-height: 1.2;
						margin-bottom: 12px;
					}
					.desc {
						font-size: 14px;
						color: #4B5563;
						line-height: 1.5;
						margin-bottom: 20px;
					}
					.btn-row {
						display: flex;
						flex-wrap: wrap;
						gap: 12px;
						margin-bottom: 16px;
					}
					.btn-primary {
						flex: 1;
						min-width: 140px;
						background: #E8451A;
						color: #ffffff;
						border: 2px solid #0D0D0D;
						border-radius: 10px;
						box-shadow: 4px 4px 0px 0px #0D0D0D;
						padding: 12px 16px;
						font-size: 13px;
						font-weight: 900;
						text-transform: uppercase;
						cursor: pointer;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						gap: 8px;
					}
					.btn-secondary {
						background: #ffffff;
						color: #0D0D0D;
						border: 2px solid #0D0D0D;
						border-radius: 10px;
						box-shadow: 4px 4px 0px 0px #0D0D0D;
						padding: 12px 16px;
						font-size: 13px;
						font-weight: 900;
						text-transform: uppercase;
						cursor: pointer;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						gap: 8px;
						text-decoration: none;
					}
					.cache-box {
						background: #FFE8DC;
						border: 2px solid #0D0D0D;
						border-radius: 10px;
						padding: 12px;
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 12px;
					}
					.btn-reset {
						background: #ffffff;
						color: #DC2626;
						border: 2px solid #0D0D0D;
						box-shadow: 2px 2px 0px 0px #0D0D0D;
						border-radius: 8px;
						padding: 8px 12px;
						font-size: 12px;
						font-weight: 800;
						cursor: pointer;
						white-space: nowrap;
					}
				`}</style>
			</head>
			<body>
				<div className='card'>
					<span className='badge'>System Notice</span>
					<h1 className='title'>Aplikasi Perlu Dimuat Ulang</h1>
					<p className='desc'>
						Terjadi kendala teknis saat memuat sistem utama. Silakan muat ulang halaman ini atau bersihkan data sementara browser Anda.
					</p>

					<div className='btn-row'>
						<button type='button' onClick={handleReload} className='btn-primary'>
							<RotateCcw style={{ width: 16, height: 16 }} />
							Muat Ulang
						</button>
						<button type='button' onClick={() => (window.location.href = '/')} className='btn-secondary'>
							<Home style={{ width: 16, height: 16 }} />
							Beranda
						</button>
					</div>

					<div className='cache-box'>
						<div>
							<div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase' }}>Tetap Gagal?</div>
							<div style={{ fontSize: 12, color: '#4B5563' }}>Hapus cache & session lokal browser.</div>
						</div>
						<button
							type='button'
							onClick={handleClearAndReload}
							disabled={isClearing}
							className='btn-reset'
						>
							<Trash2 style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
							{isClearing ? 'Proses...' : 'Reset Cache'}
						</button>
					</div>
				</div>
			</body>
		</html>
	);
}
