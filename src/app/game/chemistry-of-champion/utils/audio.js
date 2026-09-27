// Web Audio API Synthesizer for game SFX without any external asset files

class SoundFX {
	constructor() {
		this.ctx = null;
		this.isMuted = false;
	}

	init() {
		if (!this.ctx && typeof window !== 'undefined') {
			const AudioContext = window.AudioContext || window.webkitAudioContext;
			if (AudioContext) {
				this.ctx = new AudioContext();
			}
		}
		if (this.ctx && this.ctx.state === 'suspended') {
			this.ctx.resume();
		}
	}

	setMuted(muted) {
		this.isMuted = muted;
	}

	// Short snappy click/pop when pressing tiles
	playClick() {
		if (this.isMuted) return;
		this.init();
		if (!this.ctx) return;

		try {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = 'sine';
			osc.frequency.setValueAtTime(440, this.ctx.currentTime);
			osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.05);

			gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

			osc.connect(gain);
			gain.connect(this.ctx.destination);

			osc.start();
			osc.stop(this.ctx.currentTime + 0.06);
		} catch (e) {
			console.debug('Audio error:', e);
		}
	}

	// Ticking sound for countdown
	playTick(isUrgent = false) {
		if (this.isMuted) return;
		this.init();
		if (!this.ctx) return;

		try {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = 'triangle';
			const freq = isUrgent ? 880 : 550;
			osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

			gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

			osc.connect(gain);
			gain.connect(this.ctx.destination);

			osc.start();
			osc.stop(this.ctx.currentTime + 0.05);
		} catch (e) {
			console.debug('Audio error:', e);
		}
	}

	// Bright celebratory chime for correct answer / point claim
	playCorrect() {
		if (this.isMuted) return;
		this.init();
		if (!this.ctx) return;

		try {
			const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
			notes.forEach((freq, idx) => {
				const osc = this.ctx.createOscillator();
				const gain = this.ctx.createGain();
				osc.type = 'sine';
				const startTime = this.ctx.currentTime + idx * 0.08;
				osc.frequency.setValueAtTime(freq, startTime);

				gain.gain.setValueAtTime(0.25, startTime);
				gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

				osc.connect(gain);
				gain.connect(this.ctx.destination);

				osc.start(startTime);
				osc.stop(startTime + 0.32);
			});
		} catch (e) {
			console.debug('Audio error:', e);
		}
	}

	// Low buzz for wrong answer / failed question
	playWrong() {
		if (this.isMuted) return;
		this.init();
		if (!this.ctx) return;

		try {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = 'sawtooth';
			osc.frequency.setValueAtTime(180, this.ctx.currentTime);
			osc.frequency.setValueAtTime(130, this.ctx.currentTime + 0.15);

			gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
			gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);

			osc.connect(gain);
			gain.connect(this.ctx.destination);

			osc.start();
			osc.stop(this.ctx.currentTime + 0.36);
		} catch (e) {
			console.debug('Audio error:', e);
		}
	}

	// Victory fanfare when game over / podium is reached
	playVictory() {
		if (this.isMuted) return;
		this.init();
		if (!this.ctx) return;

		try {
			// Melodic Fanfare: G4, C5, E5, G5, E5, G5
			const melody = [
				{ f: 392.0, d: 0.15, pause: 0 },
				{ f: 523.25, d: 0.15, pause: 0.15 },
				{ f: 659.25, d: 0.15, pause: 0.3 },
				{ f: 783.99, d: 0.35, pause: 0.45 },
				{ f: 659.25, d: 0.15, pause: 0.8 },
				{ f: 783.99, d: 0.6, pause: 0.95 },
			];

			melody.forEach((note) => {
				const osc = this.ctx.createOscillator();
				const gain = this.ctx.createGain();
				osc.type = 'triangle';
				const startTime = this.ctx.currentTime + note.pause;
				osc.frequency.setValueAtTime(note.f, startTime);

				gain.gain.setValueAtTime(0.3, startTime);
				gain.gain.exponentialRampToValueAtTime(0.001, startTime + note.d);

				osc.connect(gain);
				gain.connect(this.ctx.destination);

				osc.start(startTime);
				osc.stop(startTime + note.d + 0.05);
			});
		} catch (e) {
			console.debug('Audio error:', e);
		}
	}
}

export const soundFX = new SoundFX();
