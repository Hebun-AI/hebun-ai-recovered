/*
 * heby-visualizer.tsx — Heby's presence field (HW2 origin, HW3 refinement). The visual anchor of
 * the Heby workspace, and the thing that should make Heby recognizable from a screenshot even with
 * the word "Heby" removed.
 *
 * TRUTHFULNESS CONTRACT — read before extending.
 *
 * This is a product presence element, not telemetry. It renders exactly six states, each driven by
 * REAL UI/runtime state supplied by the container:
 *
 *   idle         nothing in flight
 *   composing    the operator has text in the composer (a local UI fact)
 *   responding   a conversation request is genuinely in flight
 *   listening    a microphone stream is GENUINELY OPEN (Voice V1)
 *   speaking     an answer is GENUINELY being played back (Voice V1)
 *   unavailable  the surface cannot take a question right now
 *
 * It must never animate on a timer that is disconnected from an actual request. There is no
 * simulated "thinking": `responding` begins when the request starts and ends when it resolves.
 * `unavailable` is completely still — a dimmed live animation would read as "working", which would
 * be a lie. A more visually alive Heby implies NOTHING about provider health, connectivity,
 * reasoning, agents, or background work; none of those have an authoritative read seam.
 *
 * AUDIO (Voice V1 — now real, and narrowly so). `audioLevel` is a normalized 0–1 amplitude measured
 * from a real microphone stream by the voice runtime.
 *
 *   - It is READ IN EXACTLY ONE STATE: `listening`. In every other state this component ignores it
 *     entirely, so a stale reading left over from a finished capture cannot animate anything.
 *   - `speaking` gets its own motion but NO amplitude. Browser speech synthesis exposes no output
 *     stream, so no amplitude can be measured from it — and an amplitude-shaped animation with no
 *     amplitude behind it would be a fabricated waveform. The state is honest; the level is absent.
 *   - This component still opens no microphone, creates no AudioContext, runs no recognizer, and
 *     knows nothing about wake words. It receives a number that was already measured elsewhere.
 *
 * HW3 — WHY IT IS STRONGER, AND HOW IT STAYS CALM. The presence gained hierarchy through STRUCTURE,
 * not loudness: two nested point shells give it real interior volume, a small bright nucleus gives
 * it a centre of mass, and a single lit rim gives it a silhouette — so it reads as an intelligent
 * object rather than a soft haze. What it deliberately did NOT gain: more blur, a bigger glow, neon
 * saturation, scattered particles, scanning lines, or HUD chrome. The atmosphere stayed restrained;
 * only the object inside it became more defined.
 *
 * DETERMINISM: both shells are computed once at module load from a fixed Fibonacci-sphere
 * distribution — no Math.random, no Date, no per-render variation — so server and client markup are
 * identical and the field is byte-stable across renders.
 *
 * MOTION: every animation is declared through a `motion-safe:` utility, and the global
 * `prefers-reduced-motion` rule flattens whatever survives.
 */

export type HebyPresenceState =
  | "idle"
  | "composing"
  | "responding"
  | "listening"
  | "speaking"
  | "unavailable";

/** How much room the presence gets. The workspace shrinks it as the conversation grows. */
export type HebyPresenceSize = "hero" | "compact" | "inline";

export interface HebyVisualizerProps {
  /** The real UI/runtime state. Never a simulation. */
  readonly state: HebyPresenceState;
  /**
   * Normalized 0–1 amplitude MEASURED from a real microphone stream. Read only while `listening`;
   * ignored in every other state. Omitted means silence, which is also what 0 means.
   */
  readonly audioLevel?: number;
  readonly size?: HebyPresenceSize;
  /** Hide the text caption (used where the surrounding UI already states the state). */
  readonly captionHidden?: boolean;
}

/* ── The deterministic point field ─────────────────────────────────────────────
 * Two concentric Fibonacci spheres projected orthographically. Depth (the z axis) drives radius and
 * opacity, and the points are drawn far-to-near, so the field reads as a VOLUME with an interior
 * rather than a flat ring of dots. The inner shell is what makes the presence feel dimensional
 * instead of hollow — it is structure, not extra particles.
 */
interface FieldPoint {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly o: number;
}

const VIEW = 200;
const CENTER = VIEW / 2;
const FIELD_RADIUS = 74;
const INNER_RADIUS = 42;

function buildShell(count: number, radius: number, scale: number): readonly FieldPoint[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const points: FieldPoint[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    const x = Math.cos(theta) * ring;
    const z = Math.sin(theta) * ring;
    const depth = (z + 1) / 2; // 0 = far side, 1 = near side
    points.push({
      cx: round(CENTER + x * radius),
      cy: round(CENTER - y * radius),
      // A wider depth range than HW2: near points genuinely read as nearer.
      r: round((0.5 + depth * depth * 1.45) * scale),
      o: round((0.07 + depth * depth * 0.8) * scale),
    });
  }
  // Far-to-near paint order, so nearer points sit on top. Opacity is monotonic in depth, so it is
  // the depth key; the original index breaks ties, which keeps the result fully deterministic.
  return points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => a.point.o - b.point.o || a.index - b.index)
    .map((entry) => entry.point);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

const OUTER_SHELL = buildShell(190, FIELD_RADIUS, 1);
const INNER_SHELL = buildShell(96, INNER_RADIUS, 0.78);

/**
 * Orbital traces. Static geometry; the groups they live in are what rotate. Two groups turning in
 * opposite directions give the field a quiet sense of depth without any of it meaning anything.
 */
const OUTER_ORBITS: ReadonlyArray<{ ry: number; rotate: number; opacity: number; width: number }> = [
  { ry: 30, rotate: -22, opacity: 0.55, width: 0.7 },
  { ry: 46, rotate: 62, opacity: 0.26, width: 0.5 },
];
const INNER_ORBITS: ReadonlyArray<{ ry: number; rotate: number; opacity: number; width: number }> = [
  { ry: 13, rotate: 16, opacity: 0.4, width: 0.55 },
];

/* ── State semantics ──────────────────────────────────────────────────────────── */

/** Human-readable state copy. Text, so state is never conveyed by colour or motion alone. */
const STATE_CAPTION: Record<HebyPresenceState, string> = {
  idle: "Ready",
  composing: "Waiting for your message",
  responding: "Working on your question",
  listening: "Listening",
  speaking: "Speaking the answer",
  unavailable: "Not available right now",
};

/**
 * The accessible name. Each one describes exactly what is happening — `listening` is stated only
 * when a microphone stream is genuinely open, and disappears the moment it closes.
 */
const STATE_LABEL: Record<HebyPresenceState, string> = {
  idle: "Heby is ready for a question",
  composing: "Heby is waiting for you to finish typing",
  responding: "Heby is working on your question",
  listening: "Heby is listening to your microphone",
  speaking: "Heby is speaking the answer aloud",
  unavailable: "Heby is not available right now",
};

/** Orbit period and core-pulse period per state. `unavailable` gets no motion at all. */
const MOTION: Record<HebyPresenceState, { orbit: string; pulse: string } | null> = {
  idle: { orbit: "52s", pulse: "7s" },
  composing: { orbit: "34s", pulse: "4.5s" },
  responding: { orbit: "13s", pulse: "1.9s" },
  /*
   * Listening is ATTENTIVE, not busy: the base motion is calmer than `responding`, because the
   * liveliness the operator should notice comes from their own voice, not from a faster spin.
   */
  listening: { orbit: "26s", pulse: "3.4s" },
  /* Speaking has a steady cadence of its own. It is NOT amplitude — see the contract above. */
  speaking: { orbit: "18s", pulse: "2.4s" },
  unavailable: null,
};

/*
 * G7 RAISED THE HERO CEILING, and only the ceiling.
 *
 * The approved reference gives Heby the room to read as a presence occupying a space rather than a
 * mark above a prompt, and at `lg` it was still sized like the latter. The existing steps are
 * unchanged — `size-72` remains what a 1024–1279px viewport gets — and a genuinely wide desktop,
 * which is what the reference depicts, now gets substantially more.
 *
 * This is a SIZE, and it changes nothing else. The six states, their captions, their accessible
 * names, the deterministic point field and the motion contract are all untouched: a larger Heby
 * makes no additional claim, because the claim was never in the geometry.
 */
const SIZE_CLASS: Record<HebyPresenceSize, string> = {
  /*
   * THE CEILING IS BOUNDED BY BOTH AXES OF THE ROOM THE HERO ACTUALLY HAS.
   *
   * Three attempts were measured against the real product. Sized off viewport WIDTH alone the
   * presence cropped the surface it was meant to occupy. Height breakpoints failed one step later,
   * because a threshold is a guess about a budget that varies with the chrome around it. A `dvh`
   * share fixed the vertical crop and left the horizontal one: inside the Hebun shell the hero's
   * width is the window minus the rail, minus the secondary column, minus the contextual rail —
   * none of which a viewport unit can see, and all of which move when the operator enters or leaves
   * focused mode.
   *
   * `min(36rem, 66cqh, 34cqw)` is a bound on the ROOM. The container is the hero's own scroll
   * region (`.heby-hero-room`, `container-type: size` — see globals.css), so both terms measure the
   * space that actually exists after every piece of chrome has taken its share, and they re-measure
   * themselves when that chrome changes. The presence is therefore as large as the room allows and
   * can never be larger than the room, on both axes, without a single breakpoint to maintain.
   *
   * THE SAME EXPRESSION APPEARS IN heby-workspace.tsx, and that is a duplication under protest. It
   * belongs in one custom property that both consume, and it WAS one — but the build pipeline drops
   * a custom property whose value is a `min()` of mixed absolute and container units, silently, so
   * the presence fell back to its `lg` step in the real product while every test still passed. Two
   * literals that a test pins to each other is the honest version of that trade.
   *
   * THE SHARES ARE 66cqh AND 34cqw, AND BOTH ARE MEASURED CEILINGS RATHER THAN TIMIDITY. The hero
   * region also holds the state caption; the width share leaves the two peripheral labels their
   * columns. The presence reads larger than either share anyway, because most of its size is the
   * atmospheric field around it — a sibling layer with no such budget, which is how the approved
   * reference gets its scale.
   *
   * The lower steps are unchanged: `size-72` is still exactly what a 1024–1279px viewport gets.
   */
  hero: "size-44 sm:size-60 lg:size-72 xl:size-[min(36rem,66cqh,34cqw)]",
  compact: "size-24 sm:size-28",
  inline: "size-8",
};

const FIELD_OPACITY: Record<HebyPresenceState, string> = {
  idle: "opacity-85",
  composing: "opacity-95",
  responding: "opacity-100",
  listening: "opacity-100",
  speaking: "opacity-100",
  unavailable: "opacity-25",
};

/** Clamp to the declared contract. An out-of-range or non-finite level becomes silence, not motion. */
function clampAudioLevel(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return value > 1 ? 1 : Math.round(value * 1000) / 1000;
}

export function HebyVisualizer(props: HebyVisualizerProps) {
  const { state, size = "hero", captionHidden = false } = props;
  const motion = MOTION[state];
  const still = motion === null;
  const accent = still ? "text-fg-muted" : "text-(--heby-presence)";
  const orbitStyle = still ? undefined : ({ "--heby-orbit": motion.orbit } as React.CSSProperties);

  /*
   * THE ONE PLACE `audioLevel` IS READ, and it is gated on the single state that has a live
   * measurement behind it. In every other state the level is 0 by construction, so a value left
   * over from a finished capture — or one supplied by a caller that should not have — moves nothing.
   */
  const audio = state === "listening" ? clampAudioLevel(props.audioLevel) : 0;
  const reactive = state === "listening";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        role="img"
        aria-label={STATE_LABEL[state]}
        data-heby-presence={state}
        data-heby-size={size}
        /* Addressable in the browser, so "the orb moved" can be checked against a real number. */
        data-heby-audio={audio}
        style={{ "--heby-audio": audio } as React.CSSProperties}
        className={`relative grid ${SIZE_CLASS[size]} place-items-center`}
      >
        {/*
         * Atmospheric field. Layered radial light, deliberately restrained — not a glow ring. While
         * listening its opacity is a function of the MEASURED level; otherwise it is a fixed value
         * per state.
         */}
        <span
          aria-hidden="true"
          className={`absolute inset-[-26%] rounded-full bg-(image:--heby-aura) transition-opacity duration-(--dur-slow) ${
            still ? "opacity-0" : reactive ? "heby-audio-aura" : state === "idle" ? "opacity-60" : "opacity-100"
          }`}
        />

        {/* Expanding traces — ONLY while a request is genuinely in flight. */}
        {state === "responding" ? (
          <>
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-(--heby-presence)/40 opacity-0 motion-safe:[animation:heby-ripple_2.8s_var(--ease-out)_infinite]"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-(--heby-presence)/40 opacity-0 motion-safe:[animation:heby-ripple_2.8s_var(--ease-out)_infinite_1.4s]"
            />
          </>
        ) : null}

        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          aria-hidden="true"
          focusable="false"
          className={`relative size-full overflow-visible transition-opacity duration-(--dur-slow) ${accent} ${FIELD_OPACITY[state]}`}
        >
          <defs>
            <radialGradient id="heby-core" cx="50%" cy="42%" r="58%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.42" />
              <stop offset="52%" stopColor="currentColor" stopOpacity="0.11" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            {/* The nucleus: a small, defined centre of mass. It is what gives the orb an inside. */}
            <radialGradient id="heby-nucleus" cx="50%" cy="44%" r="50%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
              <stop offset="38%" stopColor="currentColor" stopOpacity="0.5" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            {/* A single lit edge. One light source, upper-left — this is what makes it an OBJECT. */}
            <linearGradient id="heby-rim" x1="18%" y1="6%" x2="82%" y2="96%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.72" />
              <stop offset="44%" stopColor="currentColor" stopOpacity="0.2" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {/* Core light. Breathes only when Heby is available. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={FIELD_RADIUS}
            fill="url(#heby-core)"
            className={still ? "" : "origin-center motion-safe:[animation:heby-breathe_var(--heby-pulse)_var(--ease-in-out)_infinite]"}
            style={still ? undefined : ({ "--heby-pulse": motion.pulse } as React.CSSProperties)}
          />

          {/* Interior shell — drawn first so the outer shell reads as being in front of it. */}
          <g fill="currentColor">
            {INNER_SHELL.map((point, index) => (
              <circle key={`i-${index}`} cx={point.cx} cy={point.cy} r={point.r} opacity={point.o} />
            ))}
          </g>

          {/* Inner orbital trace — counter-rotating, so the field has depth rather than spin. */}
          <g
            className={still ? "" : "origin-center motion-safe:[animation:heby-orbit-reverse_var(--heby-orbit)_linear_infinite]"}
            style={orbitStyle}
          >
            {INNER_ORBITS.map((orbit) => (
              <ellipse
                key={`inner-${orbit.rotate}`}
                cx={CENTER}
                cy={CENTER}
                rx={INNER_RADIUS + 10}
                ry={orbit.ry}
                fill="none"
                stroke="currentColor"
                strokeWidth={orbit.width}
                opacity={orbit.opacity}
                transform={`rotate(${orbit.rotate} ${CENTER} ${CENTER})`}
              />
            ))}
          </g>

          {/*
           * The nucleus. Small and crisp: presence needs a centre, not a bigger glow. The group is
           * what carries the measured amplitude, so the nucleus keeps its own breathing animation
           * (a CSS animation and a CSS transform cannot share one element) and the two compose.
           */}
          <g className={reactive ? "heby-audio-scale" : undefined}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={13}
              fill="url(#heby-nucleus)"
              className={still ? "" : "origin-center motion-safe:[animation:heby-breathe_var(--heby-pulse)_var(--ease-in-out)_infinite]"}
              style={still ? undefined : ({ "--heby-pulse": motion.pulse } as React.CSSProperties)}
            />
          </g>

          {/* The outer shell — the substance of the presence. It answers to the voice far more
              faintly than the nucleus does: the field should swell, not jump. */}
          <g fill="currentColor" className={reactive ? "heby-audio-scale-soft" : undefined}>
            {OUTER_SHELL.map((point, index) => (
              <circle key={`o-${index}`} cx={point.cx} cy={point.cy} r={point.r} opacity={point.o} />
            ))}
          </g>

          {/* The lit rim. A silhouette, so the presence has an edge instead of dissolving. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={FIELD_RADIUS}
            fill="none"
            stroke="url(#heby-rim)"
            strokeWidth={1.1}
          />

          {/* Outer orbital traces. The group rotates; the ellipses themselves are static geometry. */}
          <g
            className={still ? "" : "origin-center motion-safe:[animation:heby-orbit_var(--heby-orbit)_linear_infinite]"}
            style={orbitStyle}
          >
            {OUTER_ORBITS.map((orbit) => (
              <ellipse
                key={orbit.rotate}
                cx={CENTER}
                cy={CENTER}
                rx={FIELD_RADIUS + 7}
                ry={orbit.ry}
                fill="none"
                stroke="currentColor"
                strokeWidth={orbit.width}
                opacity={orbit.opacity}
                transform={`rotate(${orbit.rotate} ${CENTER} ${CENTER})`}
              />
            ))}
          </g>
        </svg>
      </div>

      {captionHidden ? null : (
        <p
          aria-live="polite"
          className={`text-[0.7rem] font-medium uppercase tracking-[0.18em] ${
            still ? "text-fg-muted" : "text-fg-secondary"
          }`}
        >
          {STATE_CAPTION[state]}
        </p>
      )}
    </div>
  );
}
