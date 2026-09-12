/**
 * The simulation's state and physics authority.
 *
 * Every quantity lives here in **SI base units** — metres, seconds, kilograms,
 * amperes, volts, ohms, kelvin — regardless of what the control that sets it is
 * labelled in. A slider marked "cm" converts on the way in; nothing downstream
 * ever has to ask which unit a number is in.
 *
 * Three responsibilities, and no more:
 *
 *   1. hold the state,
 *   2. run it forward in time through a pure integrator,
 *   3. tell anyone who asked that it changed.
 *
 * It does not draw, does not know React exists, and does not know what a canvas
 * is. That is what makes it testable in isolation and what lets the same state
 * drive an SVG apparatus, a canvas render loop and a printed observation table
 * at the same time without any of them disagreeing.
 */

export type Scalar = number | boolean | string;
export type EngineState = Record<string, Scalar>;

/** A quantity's SI unit, recorded so a reader never has to guess. */
export type UnitMap<S> = Partial<Record<keyof S, string>>;

export interface EngineOptions<S extends EngineState, D extends Record<string, number> = Record<string, number>> {
  /** Starting state, in SI units. */
  initial: S;
  /** SI unit of each field, for documentation and for the readout layer. */
  units?: UnitMap<S>;
  /**
   * Pure derived quantities — the physics. Given the state, return the numbers
   * the experiment actually measures. Recomputed lazily and memoised per
   * state version, so reading it every frame costs nothing while nothing moves.
   */
  derive?: (state: Readonly<S>, time: number) => D;
  /**
   * Advances time-dependent state by `dt` seconds. Pure: it returns the next
   * state rather than mutating the current one, so a step can be replayed,
   * tested, or run backwards for an undo without special cases.
   *
   * Omit it for a steady-state experiment; the clock still advances, which is
   * all an animation phase needs.
   */
  integrate?: (state: Readonly<S>, dt: number, time: number) => Partial<S>;
  /**
   * Largest time step the integrator is trusted with, in seconds. A longer
   * `step` is split into several sub-steps rather than integrated in one jump,
   * which is what keeps a trajectory stable instead of exploding.
   */
  maxStep?: number;
  /**
   * Ceiling on the sub-steps one `step` may take, so a very long step cannot
   * lock the thread. Past it the sub-step grows instead: accuracy degrades,
   * but the clock still advances by exactly the time it was asked for. The
   * engine never silently swallows time — deciding how much wall-clock time to
   * believe is the render loop's job, not the physics'.
   */
  maxSubSteps?: number;
}

export type Listener<S extends EngineState> = (state: Readonly<S>) => void;

export class PhysicsEngine<
  S extends EngineState,
  D extends Record<string, number> = Record<string, number>
> {
  private state: S;
  private readonly initial: S;
  private readonly options: EngineOptions<S, D>;
  private listeners = new Set<Listener<S>>();
  private t = 0;
  /** Bumped on every change. A render loop compares it to skip idle redraws. */
  private rev = 0;
  private cache: { rev: number; time: number; value: D } | null = null;

  constructor(options: EngineOptions<S, D>) {
    this.options = options;
    this.initial = { ...options.initial };
    this.state = { ...options.initial };
  }

  /* ── reading ──────────────────────────────────────────────────────────── */

  /** The live state. Treat it as read-only; `set`/`patch` are the way in. */
  get snapshot(): Readonly<S> {
    return this.state;
  }

  /** Simulation time in seconds since the last reset. */
  get time(): number {
    return this.t;
  }

  /** Revision counter — changes whenever the state or the clock moves. */
  get revision(): number {
    return this.rev;
  }

  get<K extends keyof S>(key: K): S[K] {
    return this.state[key];
  }

  /** A numeric field, with a fallback for a value that is missing or unusable. */
  num<K extends keyof S>(key: K, fallback = 0): number {
    const v = Number(this.state[key]);
    return Number.isFinite(v) ? v : fallback;
  }

  bool<K extends keyof S>(key: K, fallback = false): boolean {
    const v = this.state[key];
    return v === undefined ? fallback : Boolean(v);
  }

  str<K extends keyof S>(key: K, fallback = ''): string {
    const v = this.state[key];
    return v === undefined ? fallback : String(v);
  }

  unitOf<K extends keyof S>(key: K): string {
    return this.options.units?.[key] ?? '';
  }

  /**
   * The derived physics for the current state. Memoised on the revision, so
   * calling it sixty times a second while nothing changes costs one object
   * lookup rather than sixty recomputations.
   */
  derived(): D {
    if (!this.options.derive) return {} as D;
    if (this.cache && this.cache.rev === this.rev && this.cache.time === this.t) {
      return this.cache.value;
    }
    const value = this.options.derive(this.state, this.t);
    this.cache = { rev: this.rev, time: this.t, value };
    return value;
  }

  /* ── writing ──────────────────────────────────────────────────────────── */

  /** Sets one field. A write that changes nothing does not notify. */
  set<K extends keyof S>(key: K, value: S[K]): void {
    if (Object.is(this.state[key], value)) return;
    this.state = { ...this.state, [key]: value };
    this.changed();
  }

  /** Sets several fields at once, notifying once. */
  patch(partial: Partial<S>): void {
    let dirty = false;
    const next = { ...this.state };
    for (const k of Object.keys(partial) as (keyof S)[]) {
      const v = partial[k];
      if (v === undefined || Object.is(next[k], v)) continue;
      next[k] = v as S[keyof S];
      dirty = true;
    }
    if (!dirty) return;
    this.state = next;
    this.changed();
  }

  /** Back to the starting state, with the clock at zero. */
  reset(): void {
    this.state = { ...this.initial };
    this.t = 0;
    this.changed();
  }

  /** Rewinds the clock without disturbing the state — for replaying a trace. */
  resetTime(): void {
    if (this.t === 0) return;
    this.t = 0;
    this.changed();
  }

  /* ── time ─────────────────────────────────────────────────────────────── */

  /**
   * Runs the simulation forward by exactly `dt` seconds.
   *
   * The step is split into sub-steps of at most `maxStep`, because integrating
   * a long interval in one jump is how a stable orbit turns into a particle
   * leaving the screen. If that would need more sub-steps than `maxSubSteps`,
   * the sub-step grows to cover `dt` in that many pieces: the trajectory gets
   * coarser, but the clock still advances by the full amount asked for.
   *
   * Non-finite or negative steps are ignored rather than trusted. Clamping a
   * stalled browser frame is deliberately **not** done here — see `useRenderLoop`.
   */
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const budget = this.options.maxSubSteps ?? 2000;
    const max = Math.max(this.options.maxStep ?? 1 / 120, dt / budget);
    let remaining = dt;
    const integrate = this.options.integrate;

    while (remaining > 1e-9) {
      const h = Math.min(max, remaining);
      if (integrate) {
        const delta = integrate(this.state, h, this.t);
        if (delta) {
          const next = { ...this.state };
          for (const k of Object.keys(delta) as (keyof S)[]) {
            const v = delta[k];
            if (v !== undefined) next[k] = v as S[keyof S];
          }
          this.state = next;
        }
      }
      this.t += h;
      remaining -= h;
    }
    this.changed();
  }

  /* ── notification ─────────────────────────────────────────────────────── */

  /** Registers a listener and returns the function that removes it. */
  subscribe(fn: Listener<S>): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private changed(): void {
    this.rev += 1;
    for (const fn of this.listeners) fn(this.state);
  }
}

/** Convenience: builds an engine from options. */
export const createEngine = <S extends EngineState, D extends Record<string, number> = Record<string, number>>(
  options: EngineOptions<S, D>
): PhysicsEngine<S, D> => new PhysicsEngine(options);
