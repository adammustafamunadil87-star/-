export class MusicService {
  private audioCtx: AudioContext | null = null;
  private isPlaying = false;
  private nextNoteTime = 0;
  private currentNote = 0;
  private timerID: number | null = null;
  private tempo = 125;
  private lookahead = 25.0;
  private scheduleAheadTime = 0.1;

  // Catchy melody pattern (Subway Surfers vibe)
  private melody = [
    60, 60, 63, 65, 
    67, 67, 70, 67,
    65, 65, 63, 60,
    58, 58, 60, 60
  ];

  private bass = [
    36, 36, 36, 36,
    39, 39, 39, 39,
    41, 41, 41, 41,
    34, 34, 34, 34
  ];

  constructor() {
    this.audioCtx = null;
  }

  private initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  private mtof(note: number) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  private playNote(note: number, time: number, type: 'melody' | 'bass') {
    if (!this.audioCtx) return;

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type === 'melody' ? 'triangle' : 'square';
    osc.frequency.setValueAtTime(this.mtof(note), time);

    gain.gain.setValueAtTime(type === 'melody' ? 0.1 : 0.05, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.2);
  }

  private scheduler() {
    if (!this.audioCtx) return;
    while (this.nextNoteTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentNote, this.nextNoteTime);
      this.nextStep();
    }
    this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
  }

  private scheduleNote(step: number, time: number) {
    const melodyNote = this.melody[step % this.melody.length];
    const bassNote = this.bass[step % this.bass.length];

    this.playNote(melodyNote, time, 'melody');
    if (step % 2 === 0) {
      this.playNote(bassNote, time, 'bass');
    }
  }

  private nextStep() {
    const secondsPerBeat = 60.0 / (this.tempo * 2); // 8th notes
    this.nextNoteTime += secondsPerBeat;
    this.currentNote++;
  }

  public start() {
    this.initAudio();
    if (this.isPlaying) return;
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.isPlaying = true;
    this.nextNoteTime = this.audioCtx!.currentTime;
    this.scheduler();
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
    }
  }
}

export const gameMusic = new MusicService();
