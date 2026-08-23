import React from 'react';

export default function HandsOverlay({ activeKeyId, activeColor }) {
	// SVG mapping per key to determine which finger to highlight
	// Same zones as KEY_ZONES
	const fingerMapping = {
		'`': 'l-pinky', '1': 'l-pinky', 'q': 'l-pinky', 'a': 'l-pinky', 'z': 'l-pinky', 'ShiftLeft': 'l-pinky', 'Tab': 'l-pinky', 'CapsLock': 'l-pinky',
		'2': 'l-ring', 'w': 'l-ring', 's': 'l-ring', 'x': 'l-ring',
		'3': 'l-middle', 'e': 'l-middle', 'd': 'l-middle', 'c': 'l-middle',
		'4': 'l-index', '5': 'l-index', 'r': 'l-index', 't': 'l-index', 'f': 'l-index', 'g': 'l-index', 'v': 'l-index', 'b': 'l-index',
		' ': 'thumb', // We'll highlight whichever thumb is most natural, let's say both or right thumb default. For layout we highlight left thumb for space if no choice, but usually right thumb. Let's just highlight right thumb.
		'6': 'r-index', '7': 'r-index', 'y': 'r-index', 'u': 'r-index', 'h': 'r-index', 'j': 'r-index', 'n': 'r-index', 'm': 'r-index',
		'8': 'r-middle', 'i': 'r-middle', 'k': 'r-middle', ',': 'r-middle',
		'9': 'r-ring', 'o': 'r-ring', 'l': 'r-ring', '.': 'r-ring',
		'0': 'r-pinky', '-': 'r-pinky', '=': 'r-pinky', 'p': 'r-pinky', '[': 'r-pinky', ']': 'r-pinky', '\\': 'r-pinky', ';': 'r-pinky', "'": 'r-pinky', '/': 'r-pinky', 'Backspace': 'r-pinky', 'Enter': 'r-pinky', 'ShiftRight': 'r-pinky'
	};

	let activeFinger = activeKeyId ? fingerMapping[activeKeyId] : null;
	if (activeKeyId === ' ') {
		activeFinger = 'r-thumb'; // Default right thumb for spacebar
	}

	return (
		<div className="absolute inset-0 pointer-events-none z-20 flex items-end justify-center overflow-hidden mix-blend-multiply opacity-80" style={{ paddingBottom: '10px' }}>
			<svg viewBox="0 0 1000 300" className="w-[105%] max-w-[800px] h-auto drop-shadow-md transition-all duration-300">
				
				<defs>
					<style dangerouslySetInnerHTML={{__html: `
						.hand-base { fill: rgba(255, 255, 255, 0.4); stroke: #888; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
						.finger-highlight {
							fill: transparent;
							stroke: transparent;
							stroke-width: 6;
							stroke-linecap: round;
							stroke-linejoin: round;
							opacity: 0;
							transition: opacity 0.2s ease, stroke 0.2s ease, fill 0.2s ease;
						}
						.finger-highlight.active { 
							opacity: 1; 
						}
					`}} />
				</defs>

				{/* Left Hand Base */}
				<path className="hand-base" d="
					M 80 300 
					C 80 200, 100 110, 120 110 
					C 140 110, 150 180, 160 180 
					C 170 180, 190 90, 210 90 
					C 230 90, 240 160, 245 160 
					C 250 160, 260 70, 280 70 
					C 300 70, 310 160, 315 160 
					C 320 160, 340 90, 360 90 
					C 380 90, 390 200, 400 230 
					C 420 220, 450 230, 460 250 
					C 470 270, 450 300, 440 300
					Z
				" />

				{/* Left Finger Highlights */}
				<path className={`finger-highlight ${activeFinger === 'l-pinky' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 80 300 C 80 200, 100 110, 120 110 C 140 110, 150 180, 160 180 L 160 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'l-ring' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 160 300 L 160 180 C 170 180, 190 90, 210 90 C 230 90, 240 160, 245 160 L 245 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'l-middle' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 245 300 L 245 160 C 250 160, 260 70, 280 70 C 300 70, 310 160, 315 160 L 315 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'l-index' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 315 300 L 315 160 C 320 160, 340 90, 360 90 C 380 90, 390 200, 400 230 L 400 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'l-thumb' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 400 300 L 400 230 C 420 220, 450 230, 460 250 C 470 270, 450 300, 440 300 Z" />

				{/* Right Hand Base */}
				<path className="hand-base" d="
					M 560 300
					C 550 300, 530 270, 540 250
					C 550 230, 580 220, 600 230
					C 610 200, 620 90, 640 90
					C 660 90, 680 160, 685 160
					C 690 160, 700 70, 720 70
					C 740 70, 750 160, 755 160
					C 760 160, 770 90, 790 90
					C 810 90, 830 180, 840 180
					C 850 180, 860 110, 880 110
					C 900 110, 920 200, 920 300
					Z
				" />
				
				{/* Right Finger Highlights */}
				<path className={`finger-highlight ${activeFinger === 'r-thumb' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 560 300 C 550 300, 530 270, 540 250 C 550 230, 580 220, 600 230 L 600 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'r-index' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 600 300 L 600 230 C 610 200, 620 90, 640 90 C 660 90, 680 160, 685 160 L 685 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'r-middle' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 685 300 L 685 160 C 690 160, 700 70, 720 70 C 740 70, 750 160, 755 160 L 755 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'r-ring' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 755 300 L 755 160 C 760 160, 770 90, 790 90 C 810 90, 830 180, 840 180 L 840 300 Z" />
				<path className={`finger-highlight ${activeFinger === 'r-pinky' ? 'active' : ''}`} style={{ stroke: activeColor, fill: activeColor + '40' }} d="M 840 300 L 840 180 C 850 180, 860 110, 880 110 C 900 110, 920 200, 920 300 Z" />

			</svg>
		</div>
	);
}
