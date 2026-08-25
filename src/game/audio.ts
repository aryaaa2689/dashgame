/**
 * Procedural audio engine — every sound is synthesised at runtime with the
 * WebAudio API, so the game ships with zero audio assets while still having a
 * full, reactive soundscape (engine/wind loop, footsteps, pickups, impacts,
 * countdown, UI feedback, finish fanfare).
 */

type Ctx = AudioContext & { __unlocked?: boolean };

class AudioEngine {
  ctx: Ctx | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private rumbleOsc: OscillatorNode | null = null;
  private rumbleGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  enabled = true;
  musicEnabled = true;

  init() {
    if (this.ctx) return this.ctx;
    const AC =
      (window.AudioContext as typeof AudioContext) ||
      ((window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!AC) return null;
    const ctx = new AC() as Ctx;
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.9 : 0;
    this.master.connect(ctx.destination);

    // gentle bus compression so impacts never clip the mix
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    comp.connect(this.master);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.95;
    this.sfxBus.connect(comp);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.24;
    this.musicBus.connect(comp);

    // shared noise buffer (2s of pink-ish noise)
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0526;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
    }
    this.noiseBuf = buf;
    return ctx;
  }

  resume() {
    const ctx = this.init();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (this.musicBus && this.ctx)
      this.musicBus.gain.setTargetAtTime(on ? 0.24 : 0, this.ctx.currentTime, 0.1);
  }

  private now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** Core one-shot tone helper. */
  private tone(opts: {
    freq: number;
    to?: number;
    dur: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    attack?: number;
    filter?: number;
    detune?: number;
  }) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.enabled) return;
    const t = this.now() + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type ?? "sine";
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + opts.dur);
    if (opts.detune) osc.detune.value = opts.detune;
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.25;
    const atk = opts.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = opts.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + opts.dur + 0.05);
  }

  /** Filtered noise burst — used for impacts, whooshes and footsteps. */
  private noise(opts: {
    dur: number;
    gain?: number;
    freq?: number;
    to?: number;
    q?: number;
    type?: BiquadFilterType;
    delay?: number;
  }) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noiseBuf || !this.enabled) return;
    const t = this.now() + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? "bandpass";
    f.frequency.setValueAtTime(opts.freq ?? 900, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(Math.max(60, opts.to), t + opts.dur);
    f.Q.value = opts.q ?? 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.22, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + opts.dur + 0.05);
  }

  // ---------------------------------------------------------------- ambience
  startEngine() {
    const ctx = this.init();
    if (!ctx || !this.sfxBus || !this.noiseBuf || this.windSrc) return;
    // wind / rush of speed
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus);
    src.start();
    this.windSrc = src;
    this.windFilter = filter;
    this.windGain = gain;

    // low body rumble tied to pace
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 54;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 190;
    const rg = ctx.createGain();
    rg.gain.value = 0;
    osc.connect(lp);
    lp.connect(rg);
    rg.connect(this.sfxBus);
    osc.start();
    this.rumbleOsc = osc;
    this.rumbleGain = rg;
  }

  /** speed01: 0..1 normalised pace, air: 0/1 */
  updateEngine(speed01: number, air: number) {
    if (!this.ctx || !this.windGain || !this.windFilter || !this.rumbleGain || !this.rumbleOsc) return;
    const t = this.ctx.currentTime;
    const s = Math.max(0, Math.min(1.4, speed01));
    this.windGain.gain.setTargetAtTime(0.05 + s * 0.2 + air * 0.06, t, 0.12);
    this.windFilter.frequency.setTargetAtTime(360 + s * 1500, t, 0.15);
    this.rumbleGain.gain.setTargetAtTime(air > 0.2 ? 0.015 : 0.05 + s * 0.06, t, 0.12);
    this.rumbleOsc.frequency.setTargetAtTime(44 + s * 46, t, 0.15);
  }

  stopEngine() {
    try {
      this.windSrc?.stop();
      this.rumbleOsc?.stop();
    } catch {}
    this.windSrc = null;
    this.rumbleOsc = null;
    this.windGain = null;
    this.rumbleGain = null;
    this.windFilter = null;
  }

  // ------------------------------------------------------------------- sfx
  footstep(intensity = 1) {
    this.noise({ dur: 0.085, gain: 0.055 * intensity, freq: 300, to: 130, q: 0.9, type: "lowpass" });
  }

  jump() {
    this.tone({ freq: 300, to: 760, dur: 0.2, type: "triangle", gain: 0.2 });
    this.noise({ dur: 0.16, gain: 0.09, freq: 700, to: 2200, q: 0.7 });
  }

  land() {
    this.tone({ freq: 150, to: 62, dur: 0.18, type: "sine", gain: 0.28 });
    this.noise({ dur: 0.12, gain: 0.11, freq: 420, to: 120, q: 0.8, type: "lowpass" });
  }

  /** "+N" pickup — bright ascending arpeggio, brighter for bigger values. */
  pickupPlus(value: number) {
    const base = 520 + Math.min(6, value) * 42;
    for (let i = 0; i < 3; i++)
      this.tone({
        freq: base * Math.pow(1.26, i),
        dur: 0.16,
        type: "triangle",
        gain: 0.17,
        delay: i * 0.045,
      });
    this.tone({ freq: base * 2.2, dur: 0.32, type: "sine", gain: 0.08, delay: 0.09 });
  }

  /** "-N" pickup — detuned descending buzz plus an impact thud. */
  pickupMinus(value: number) {
    const base = 300 - Math.min(5, value) * 18;
    this.tone({ freq: base, to: base * 0.45, dur: 0.34, type: "sawtooth", gain: 0.16, filter: 900 });
    this.tone({
      freq: base * 0.99,
      to: base * 0.44,
      dur: 0.34,
      type: "square",
      gain: 0.08,
      detune: -22,
      filter: 700,
    });
    this.noise({ dur: 0.22, gain: 0.16, freq: 520, to: 90, q: 0.7, type: "lowpass" });
  }

  /** "xN" multiplier — rising sweep into a shimmering chord. */
  pickupMult(value: number) {
    this.tone({ freq: 220, to: 1450, dur: 0.4, type: "sawtooth", gain: 0.13, filter: 2600 });
    const chord = [660, 880, 1320];
    chord.forEach((f, i) =>
      this.tone({ freq: f * (1 + value * 0.02), dur: 0.5, type: "sine", gain: 0.11, delay: 0.28 + i * 0.02 }),
    );
    this.noise({ dur: 0.5, gain: 0.1, freq: 900, to: 5200, q: 0.5, delay: 0.1 });
  }

  turbo() {
    this.noise({ dur: 0.65, gain: 0.24, freq: 260, to: 4200, q: 0.6 });
    this.tone({ freq: 150, to: 900, dur: 0.5, type: "sawtooth", gain: 0.18, filter: 2400 });
    this.tone({ freq: 900, to: 340, dur: 0.6, type: "sine", gain: 0.08, delay: 0.28 });
  }

  ramp() {
    this.tone({ freq: 420, to: 1250, dur: 0.3, type: "triangle", gain: 0.16 });
    this.noise({ dur: 0.32, gain: 0.12, freq: 800, to: 3200, q: 0.6 });
  }

  hit() {
    this.noise({ dur: 0.26, gain: 0.26, freq: 380, to: 70, q: 0.6, type: "lowpass" });
    this.tone({ freq: 120, to: 48, dur: 0.28, type: "square", gain: 0.16, filter: 400 });
  }

  wall() {
    this.noise({ dur: 0.16, gain: 0.17, freq: 260, to: 90, q: 0.8, type: "lowpass" });
    this.tone({ freq: 96, to: 55, dur: 0.16, type: "sine", gain: 0.14 });
  }

  countdownBeep(n: number) {
    this.tone({ freq: n === 0 ? 880 : 440, dur: n === 0 ? 0.5 : 0.16, type: "square", gain: 0.14, filter: 2200 });
    this.tone({ freq: n === 0 ? 1320 : 660, dur: n === 0 ? 0.6 : 0.14, type: "sine", gain: 0.12 });
  }

  goHorn() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.85, type: "sawtooth", gain: 0.11, filter: 2600, delay: i * 0.035 }),
    );
    this.noise({ dur: 0.7, gain: 0.16, freq: 400, to: 4000, q: 0.5 });
  }

  finish(win: boolean) {
    const seq = win ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [523.25, 440, 392, 329.63];
    seq.forEach((f, i) => {
      this.tone({ freq: f, dur: 0.42, type: "triangle", gain: 0.18, delay: i * 0.11 });
      this.tone({ freq: f * 2, dur: 0.3, type: "sine", gain: 0.07, delay: i * 0.11 });
    });
    if (win) this.noise({ dur: 1.1, gain: 0.09, freq: 1200, to: 6000, q: 0.4, delay: 0.2 });
  }

  overtake() {
    this.tone({ freq: 700, to: 1180, dur: 0.18, type: "triangle", gain: 0.13 });
  }
  overtaken() {
    this.tone({ freq: 620, to: 300, dur: 0.22, type: "triangle", gain: 0.12 });
  }

  // -------------------------------------------------------------------- UI
  uiClick() {
    this.resume();
    this.tone({ freq: 620, to: 880, dur: 0.075, type: "square", gain: 0.09, filter: 3200 });
    this.noise({ dur: 0.05, gain: 0.05, freq: 2600, q: 1.6 });
  }
  uiHover() {
    this.tone({ freq: 1100, dur: 0.035, type: "sine", gain: 0.035 });
  }
  uiBack() {
    this.tone({ freq: 520, to: 320, dur: 0.11, type: "square", gain: 0.08, filter: 2200 });
  }
  uiConfirm() {
    this.tone({ freq: 660, dur: 0.1, type: "triangle", gain: 0.11 });
    this.tone({ freq: 990, dur: 0.16, type: "triangle", gain: 0.09, delay: 0.07 });
  }
  uiError() {
    this.tone({ freq: 200, to: 130, dur: 0.24, type: "sawtooth", gain: 0.12, filter: 900 });
  }

  // ---------------------------------------------------------------- music
  /** Minimal, driving tribal-percussion menu/race bed. */
  startMusic() {
    const ctx = this.init();
    if (!ctx || this.musicTimer !== null) return;
    const scale = [220, 261.63, 293.66, 349.23, 392, 523.25];
    const stepMs = 250;
    this.musicStep = 0;
    const tickFn = () => {
      if (!this.ctx || !this.musicBus || !this.musicEnabled) return;
      const s = this.musicStep++;
      const t = this.ctx.currentTime;
      const play = (freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) => {
        const osc = this.ctx!.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        const g = this.ctx!.createGain();
        g.gain.setValueAtTime(0.0001, t + delay);
        g.gain.linearRampToValueAtTime(gain, t + delay + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
        const f = this.ctx!.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = 1800;
        osc.connect(f);
        f.connect(g);
        g.connect(this.musicBus!);
        osc.start(t + delay);
        osc.stop(t + delay + dur + 0.05);
      };
      // kick on 1 & 3, wood-block accents, and a rolling bass motif
      if (s % 4 === 0) play(64, 0.22, "sine", 0.5);
      if (s % 8 === 4) play(58, 0.2, "sine", 0.4);
      if (s % 2 === 1 && this.noiseBuf) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = "bandpass";
        f.frequency.value = 1700 + (s % 4) * 260;
        f.Q.value = 3.4;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        src.connect(f);
        f.connect(g);
        g.connect(this.musicBus);
        src.start(t);
        src.stop(t + 0.12);
      }
      const note = scale[(s * 3) % scale.length];
      if (s % 4 === 2) play(note / 2, 0.3, "triangle", 0.16);
      if (s % 16 === 12) play(note, 0.5, "sine", 0.1, 0.05);
    };
    tickFn();
    this.musicTimer = window.setInterval(tickFn, stepMs);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const audio = new AudioEngine();
