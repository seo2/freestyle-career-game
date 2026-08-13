// Frame-delta animation primitives.
//
// Deliberately NOT Phaser tweens: the deterministic capture harness freezes
// Date.now and Phaser 4's TweenManager derives its delta from it, so a
// tween-driven effect sits frozen in every screenshot and is invisible to
// verification (documented in CLAUDE.md). Everything here advances on the frame
// delta a scene's update() receives, which the harness does advance.
//
// No Math.random either (lint-banned, and it would break trace parity): the
// shake below oscillates on a fixed curve, so the same kick always looks the
// same.

// A number that chases a target instead of snapping to it. Exponential easing,
// so it is frame-rate independent: half the remaining distance is covered every
// `halfLifeMs`, whatever the frame times are.
export class EasedValue {
  private current: number;
  private goal: number;

  constructor(value: number, private readonly halfLifeMs = 120) {
    this.current = value;
    this.goal = value;
  }

  get value(): number {
    return this.current;
  }

  set target(next: number) {
    this.goal = next;
  }

  // Jump straight to the target (scene entry, or a state reload where easing
  // from a stale value would read as a phantom change).
  snap(next: number = this.goal): void {
    this.goal = next;
    this.current = next;
  }

  advance(deltaMs: number): number {
    const distance = this.goal - this.current;
    if (Math.abs(distance) < 0.01) {
      this.current = this.goal;
      return this.current;
    }
    // 2^(-dt/halfLife) of the distance survives each step.
    const remaining = Math.pow(2, -deltaMs / this.halfLifeMs);
    this.current = this.goal - distance * remaining;
    return this.current;
  }
}

// A decaying screen shake. `kick` sets the amplitude in pixels; the offset
// oscillates on two different frequencies (so it does not read as a single
// axis wobble) and dies out over `durationMs`.
export class Shake {
  private elapsed = 0;
  private amplitude = 0;

  constructor(
    private readonly durationMs = 260,
    private readonly frequency = 34,
  ) {}

  kick(amplitude: number): void {
    // A new hit restarts the shake rather than stacking into a longer rumble.
    this.amplitude = amplitude;
    this.elapsed = 0;
  }

  get active(): boolean {
    return this.amplitude > 0 && this.elapsed < this.durationMs;
  }

  advance(deltaMs: number): { x: number; y: number } {
    if (!this.active) {
      this.amplitude = 0;
      return { x: 0, y: 0 };
    }
    this.elapsed += deltaMs;
    const life = Math.min(1, this.elapsed / this.durationMs);
    const decay = (1 - life) * (1 - life);
    const t = (this.elapsed / 1000) * this.frequency;
    return {
      x: Math.round(Math.sin(t) * this.amplitude * decay),
      y: Math.round(Math.cos(t * 1.7) * this.amplitude * decay * 0.6),
    };
  }
}

// A one-shot 0..1 ramp: 0 the moment it starts, 1 when it finishes. Used for
// entrances (cards dealing in) and flashes (the crowd reacting).
export class Pulse {
  private elapsed: number;

  constructor(private readonly durationMs = 220) {
    this.elapsed = durationMs;
  }

  restart(): void {
    this.elapsed = 0;
  }

  finish(): void {
    this.elapsed = this.durationMs;
  }

  get done(): boolean {
    return this.elapsed >= this.durationMs;
  }

  // Progress after advancing, eased out so entrances land softly.
  advance(deltaMs: number): number {
    if (this.done) return 1;
    this.elapsed = Math.min(this.durationMs, this.elapsed + deltaMs);
    const linear = this.elapsed / this.durationMs;
    return 1 - (1 - linear) * (1 - linear);
  }
}
