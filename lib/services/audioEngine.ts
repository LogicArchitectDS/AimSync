/**
 * lib/services/audioEngine.ts
 *
 * Web Audio API Synthesizer Engine for AimSync.
 *
 * Goals:
 *  - Zero static audio files – all sounds are generated on the fly.
 *  - Adaptive hit pitch that climbs with the current combo multiplier.
 *  - Distinct miss buzz tone that signals a broken rhythm.
 *  - Strict node disposal to prevent progressive thread leaks.
 *  - All work is scheduled on the AudioContext timeline (off the rAF loop).
 *  - Respects the user's `soundEnabled` preference from userSettingsStorage.
 */

import { getStoredSettings } from "@/lib/utils/userSettingsStorage";

class AudioEngine {
  private ctx: AudioContext | null = null;

  // ─── Context Lifecycle ──────────────────────────────────────────────────────

  /**
   * Must be called on the first user interaction (mousedown / click).
   * Creates the AudioContext once and resumes it if suspended by the browser.
   */
  init(): void {
    if (typeof window === "undefined") return;

    if (!this.ctx) {
      this.ctx = new (
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext!
      )();
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /** Suspend the context when a session ends (saves CPU while idle). */
  suspend(): void {
    if (this.ctx && this.ctx.state === "running") {
      this.ctx.suspend();
    }
  }

  /** Re-open a suspended context – call before any session starts. */
  resume(): void {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // ─── Internal Helper ─────────────────────────────────────────────────────────

  private isSoundEnabled(): boolean {
    try {
      return getStoredSettings().soundEnabled;
    } catch {
      return true; // fail open
    }
  }

  // ─── Hit Sound ───────────────────────────────────────────────────────────────

  /**
   * Plays a crisp, punchy sine tone whose pitch rises with the active combo.
   *
   * Frequency formula (exponential crescendo):
   *   f = 440 × (1 + ln(1 + combo / 15))
   *
   * Gain envelope:
   *   t₀ → 0.3 (instant)
   *   t₀ + 0.08 → 0.0001 (exponential ramp)
   *   node released at t₀ + 0.1
   */
  playHitSound(currentCombo: number): void {
    if (!this.ctx || !this.isSoundEnabled()) return;

    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // ── Frequency calculation ────────────────────────────────────────────────
    const freq = 440 * (1 + Math.log(1 + currentCombo / 15));

    // ── Oscillator ───────────────────────────────────────────────────────────
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);

    // ── Gain (ultra-sharp decay) ──────────────────────────────────────────────
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);

    // ── Routing ──────────────────────────────────────────────────────────────
    osc.connect(gain);
    gain.connect(ctx.destination);

    // ── Schedule release & explicit GC ───────────────────────────────────────
    osc.start(t0);
    osc.stop(t0 + 0.1);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }

  // ─── Miss Sound ──────────────────────────────────────────────────────────────

  /**
   * Plays a low-frequency sawtooth buzz to signal a broken streak.
   *
   * Frequency sweep: 120 Hz → 80 Hz over 0.15 s (failure-buzz contour).
   * Gain: 0.2 → 0.0001 over 0.2 s.
   */
  playMissSound(): void {
    if (!this.ctx || !this.isSoundEnabled()) return;

    const ctx = this.ctx;
    const t0 = ctx.currentTime;

    // ── Oscillator ───────────────────────────────────────────────────────────
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, t0);
    osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.15);

    // ── Gain ─────────────────────────────────────────────────────────────────
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);

    // ── Routing ──────────────────────────────────────────────────────────────
    osc.connect(gain);
    gain.connect(ctx.destination);

    // ── Schedule release & explicit GC ───────────────────────────────────────
    osc.start(t0);
    osc.stop(t0 + 0.22);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }
}

// ─── Singleton Export ─────────────────────────────────────────────────────────

export const audioEngine = new AudioEngine();
