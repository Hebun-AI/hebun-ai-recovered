import type { ReactNode } from "react";
import type { LiveMapNodeStatus } from "@/features/live-map/contracts";

/*
 * LIVE MAP — THE AGENT'S OFFICE (PHASE 3B).
 *
 * A small isometric office with a seated robot on every agent card. It is decoration, it is hidden
 * from assistive technology, and every fact a reader needs stays in the card's own words.
 *
 * ── IT SHOWS NO WORK, BECAUSE NOTHING CAN PROVE WORK ─────────────────────────
 *
 * Hebun has no signal that says "this agent is executing now": no heartbeat, no lease, and an
 * invocation left `registered` means the outcome is unknown. So the robot sits turned away from a
 * monitor on standby, and nothing here moves. `In service` is a lifecycle word; it is not activity,
 * and no tone below draws anything that could be read as activity.
 *
 *     SEATED != WORKING        IN SERVICE != ACTIVE NOW
 *
 * ── ONLY TWO THINGS REACH THIS FILE ──────────────────────────────────────────
 *
 * The node id picks the room and the head. It is hashed as an opaque string and never parsed, and
 * neither it nor the agent's name is printed, so no mapping of real agents to pictures can exist and
 * an agent registered tomorrow is dressed without a change here. The lifecycle tone picks the room's
 * state, and it comes from the owning authority. No count, name or authority reaches this file.
 *
 *     VARIANT != IDENTITY
 *
 * ── STATIC BY CONSTRUCTION ───────────────────────────────────────────────────
 *
 * This is a server component of plain SVG elements. There is no `dangerouslySetInnerHTML`, no text
 * element, no file and no outside reference, and the drawing is one sprite shared by every card, so
 * a map of any size costs one drawing. Colour comes from `--lms-*` in the Live Map scope.
 */

export type OfficeTone = LiveMapNodeStatus["tone"];

/** FNV-1a. Stable, dependency-free and pinned by a test, because changing it re-dresses every agent. */
function hashOpaqueId(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The cosmetic variant for a node. A pure function of the id; it means nothing and stores nothing. */
export function officeVariant(nodeId: string): { readonly room: number; readonly head: number } {
  const hash = hashOpaqueId(nodeId);
  return { room: (hash % 4) + 1, head: ((hash >>> 8) % 4) + 1 };
}

/* ── The projection: one isometric grid, with the room in the top of a 202 × 161 frame ───── */

const ORIGIN_X = 327;
const ORIGIN_Y = 49;
const SIDE = 105;
const WALL = 46;

type Point = readonly [number, number];

const iso = (x: number, y: number, z = 0): Point => [
  Number((ORIGIN_X + (x - y) * 0.866).toFixed(1)),
  Number((ORIGIN_Y + (x + y) * 0.5 - z).toFixed(1)),
];

const points = (corners: readonly Point[]): string => corners.map((corner) => corner.join(",")).join(" ");
const token = (name: string): string => `var(--lms-${name})`;
const paint = (name: string): string => `url(#lms-${name})`;

function Face({ at, fill, opacity }: { at: readonly Point[]; fill: string; opacity?: number }) {
  return <polygon points={points(at)} fill={fill} opacity={opacity} />;
}

/** A box seen from above: its two visible sides and its top. */
function Box({
  at: [x, y, z],
  size: [w, d, h],
  top,
  left,
  right,
}: {
  at: readonly [number, number, number];
  size: readonly [number, number, number];
  top: string;
  left: string;
  right: string;
}) {
  return (
    <g>
      <Face at={[iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]} fill={left} />
      <Face at={[iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)]} fill={right} />
      <Face at={[iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]} fill={top} />
    </g>
  );
}

/** A flat rectangle laid on the wall along the y axis. */
function OnWall({ y, z, width, height, fill, opacity }: { y: number; z: number; width: number; height: number; fill: string; opacity?: number }) {
  return (
    <Face
      at={[iso(0.5, y, z), iso(0.5, y + width, z), iso(0.5, y + width, z + height), iso(0.5, y, z + height)]}
      fill={fill}
      opacity={opacity}
    />
  );
}

function Plant({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  const [px, py] = iso(x, y);
  return (
    <g transform={`translate(${px} ${py}) scale(${scale})`}>
      <ellipse cx="0" cy="1" rx="8" ry="3.4" fill={paint("shadow")} />
      <path d="M-5 -9h10l-1.6 10h-6.8z" fill={token("steel-6")} />
      <ellipse cx="0" cy="-9" rx="5" ry="1.8" fill={token("steel-5")} />
      <path d="M0-9C-2-18-8-21-11-22c1 6 4 11 11 13Z" fill={paint("leaf")} />
      <path d="M0-9C2-19 7-24 11-26c0 8-3 14-11 17Z" fill={paint("leaf")} />
      <path d="M0-9C-1-20 0-27 1-31c3 7 2 15-1 22Z" fill={token("leaf-c")} />
    </g>
  );
}

/* ── The room: the shell every variant shares ─────────────────────────────────────────── */

function Shell() {
  return (
    <g>
      <ellipse cx={ORIGIN_X} cy={ORIGIN_Y + 104} rx="100" ry="24" fill={paint("glow")} opacity="0.55" />
      <Face at={[iso(0, SIDE), iso(SIDE, SIDE), iso(SIDE, SIDE, -5), iso(0, SIDE, -5)]} fill={token("slab-a")} />
      <Face at={[iso(SIDE, 0), iso(SIDE, SIDE), iso(SIDE, SIDE, -5), iso(SIDE, 0, -5)]} fill={token("slab-b")} />
      <Face at={[iso(0, 0), iso(SIDE, 0), iso(SIDE, 0, WALL), iso(0, 0, WALL)]} fill={paint("wall-right")} />
      <Face at={[iso(0, 0), iso(0, SIDE), iso(0, SIDE, WALL), iso(0, 0, WALL)]} fill={paint("wall-left")} />
      <Face at={[iso(0, 0), iso(SIDE, 0), iso(SIDE, SIDE), iso(0, SIDE)]} fill={paint("floor")} />
      <polyline points={points([iso(0, SIDE, WALL), iso(0, 0, WALL), iso(SIDE, 0, WALL)])} fill="none" stroke={token("edge")} strokeWidth="0.9" />
      <polyline points={points([iso(0, SIDE), iso(0, 0), iso(SIDE, 0)])} fill="none" stroke={token("seam")} strokeWidth="1" />
    </g>
  );
}

const STEEL_BOX = { top: token("steel-4"), left: token("steel-5"), right: token("steel-6") };

const ROOMS: Readonly<Record<number, ReactNode>> = {
  /* The corner window. */
  1: (
    <>
      <OnWall y={16} z={12} width={62} height={28} fill={paint("sky")} />
      {[34, 52].map((y) => (
        <OnWall key={y} y={y} z={12} width={0.9} height={28} fill={token("slab-a")} />
      ))}
      <OnWall y={16} z={25} width={62} height={0.9} fill={token("slab-a")} />
      <Face at={[iso(1, 16, 0.1), iso(30, 16, 0.1), iso(30, 78, 0.1), iso(1, 78, 0.1)]} fill={token("violet")} opacity={0.09} />
      <Plant x={10} y={92} />
    </>
  ),
  /* The shelves. Plain volumes: a book would need a title, and a title is a word. */
  2: (
    <>
      <Box at={[1, 22, 30]} size={[3, 58, 1.6]} {...STEEL_BOX} />
      <Box at={[1, 22, 15]} size={[3, 58, 1.6]} {...STEEL_BOX} />
      <Box at={[1.5, 28, 31.6]} size={[3, 9, 8]} {...STEEL_BOX} />
      <Box at={[1.5, 41, 31.6]} size={[3, 6, 11]} top={token("violet")} left={token("violet-b")} right={token("violet-c")} />
      <Box at={[1.5, 63, 31.6]} size={[3, 11, 6]} top={token("blue")} left={token("blue-b")} right={token("blue-c")} />
      <Box at={[1.5, 30, 16.6]} size={[3, 7, 9]} top={token("steel-2")} left={token("steel-3")} right={token("steel-4")} />
      <Box at={[1.5, 52, 16.6]} size={[3, 14, 5]} {...STEEL_BOX} />
      <Plant x={92} y={90} scale={0.82} />
    </>
  ),
  /* The light lines, and a low seat. */
  3: (
    <>
      {[22, 36, 50, 64, 78].map((y) => (
        <OnWall key={y} y={y} z={6} width={1.5} height={36} fill={token("violet")} opacity={0.75} />
      ))}
      <Face at={[iso(1, 16, 0.1), iso(26, 16, 0.1), iso(26, 84, 0.1), iso(1, 84, 0.1)]} fill={token("violet")} opacity={0.08} />
      <Box at={[14, 72, 0]} size={[17, 17, 6]} {...STEEL_BOX} />
      <Box at={[14, 72, 6]} size={[17, 3, 10]} {...STEEL_BOX} />
    </>
  ),
  /* The ring lamp, and a closed cabinet. Nothing in it has a light that could be read as a status. */
  4: (
    <>
      <g transform={`translate(${iso(0.5, 46, 26).join(" ")}) matrix(.866 -.5 0 1 0 0)`}>
        <circle r="14" fill="none" stroke={token("blue")} strokeWidth="2.4" opacity="0.95" />
        <circle r="17" fill="none" stroke={token("blue")} strokeWidth="0.6" opacity="0.45" />
      </g>
      <Face at={[iso(1, 28, 0.1), iso(24, 28, 0.1), iso(24, 66, 0.1), iso(1, 66, 0.1)]} fill={token("blue")} opacity={0.1} />
      <Box at={[1, 76, 0]} size={[12, 22, 26]} {...STEEL_BOX} />
      <Face at={[iso(13.2, 86.5, 2), iso(13.2, 87.3, 2), iso(13.2, 87.3, 24), iso(13.2, 86.5, 24)]} fill={token("slab-a")} />
      <Plant x={8} y={92} scale={0.7} />
    </>
  ),
};

/* ── The desk: it faces the room, and the chair has turned away from it ──────────────── */

const MONITOR = { x: 44, y: 12, z: 25.4, width: 30, height: 19 };

function Desk() {
  const leg = { top: token("steel-6"), left: token("steel-7"), right: token("steel-7") };
  return (
    <g>
      <Box at={[30, 3, 0]} size={[2, 22, 19]} {...leg} />
      <Box at={[88, 3, 0]} size={[2, 22, 19]} {...leg} />
      <Box at={[26, 2, 19]} size={[68, 25, 2.4]} top={paint("desk-top")} left={token("steel-5")} right={token("steel-7")} />
      <Box at={[MONITOR.x + MONITOR.width / 2 - 8, MONITOR.y - 4, 21.4]} size={[16, 9, 0.9]} top={token("steel-3")} left={token("steel-5")} right={token("steel-6")} />
      <Box at={[MONITOR.x + MONITOR.width / 2 - 1.6, MONITOR.y - 2.4, 22]} size={[3.2, 3.2, 5]} top={token("steel-3")} left={token("steel-4")} right={token("steel-5")} />
      <Box
        at={[MONITOR.x - 1, MONITOR.y - 1.4, MONITOR.z - 1]}
        size={[MONITOR.width + 2, 1.4, MONITOR.height + 2]}
        top={token("steel-1")}
        left={token("steel-2")}
        right={token("steel-4")}
      />
    </g>
  );
}

const screenFace: readonly Point[] = [
  iso(MONITOR.x, MONITOR.y + 0.05, MONITOR.z),
  iso(MONITOR.x + MONITOR.width, MONITOR.y + 0.05, MONITOR.z),
  iso(MONITOR.x + MONITOR.width, MONITOR.y + 0.05, MONITOR.z + MONITOR.height),
  iso(MONITOR.x, MONITOR.y + 0.05, MONITOR.z + MONITOR.height),
];
const screenCentre = iso(MONITOR.x + MONITOR.width / 2, MONITOR.y + 0.4, MONITOR.z + MONITOR.height / 2);
const deskGlow = iso(MONITOR.x + MONITOR.width / 2, MONITOR.y + 8, 22);

/* Standby is a screen with one point of light: no line of text, no chart and nothing that scrolls. */
function MonitorStandby() {
  return (
    <g>
      <Face at={screenFace} fill={paint("screen")} />
      <circle cx={screenCentre[0]} cy={screenCentre[1]} r="1.4" fill={token("eye")} />
      <circle cx={screenCentre[0]} cy={screenCentre[1]} r="6" fill={paint("glow")} />
      <ellipse cx={deskGlow[0]} cy={deskGlow[1]} rx="26" ry="11" fill={paint("glow")} opacity="0.4" />
    </g>
  );
}

const lampFoot = iso(84, 12, 21.4);

function Lamp({ shade }: { shade: string }) {
  return (
    <g transform={`translate(${lampFoot.join(" ")})`}>
      <ellipse rx="4" ry="1.8" fill={token("steel-4")} />
      <path d="M0 0V-17l-7 -3" fill="none" stroke={token("steel-2")} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M-12-22h9l1 5h-11z" fill={shade} />
    </g>
  );
}

/* ── The chair and the family of robots: one body, four heads ─────────────────────────── */

function Chair() {
  return (
    <g>
      <ellipse cx="0" cy="3" rx="26" ry="8.5" fill={paint("shadow")} />
      <path d="M-13 4 0-1 13 4M-9-3 0-1 9-3" stroke={token("steel-2")} strokeWidth="1.9" fill="none" strokeLinecap="round" />
      <rect x="-1.6" y="-13" width="3.2" height="12" fill={token("steel-2")} />
      <rect x="-18.5" y="-52" width="37" height="38" rx="11" fill={token("chair")} stroke={token("chair-edge")} strokeWidth="0.9" />
      <ellipse cx="0" cy="-13" rx="19" ry="6.4" fill={token("seat")} />
    </g>
  );
}

function Robot() {
  const limb = { fill: "none", strokeLinecap: "round" as const };
  return (
    <g>
      <ellipse cx="0" cy="-15.5" rx="17" ry="5.6" fill={token("seat")} />
      <rect x="-10" y="-41" width="20" height="24" rx="7.6" fill={paint("metal")} />
      <rect x="-4.9" y="-34.5" width="9.8" height="6.4" rx="3.2" fill={token("metal-c")} />
      <path d="M-5-17-14.5-11.4M5-17 14.5-11.4" stroke={paint("metal-dim")} strokeWidth="9" {...limb} />
      <path d="M-15-9.5V-1.5M15-9.5V-1.5" stroke={token("metal-e")} strokeWidth="6.4" {...limb} />
      <rect x="-21" y="-.6" width="11.4" height="4.8" rx="2.4" fill={token("steel-2")} />
      <rect x="9.6" y="-.6" width="11.4" height="4.8" rx="2.4" fill={token("steel-2")} />
      <path d="M-11-37.5c-5 1-7.4 6-7.2 11.2.1 3 1.6 5.6 4.6 7.4M11-37.5c5 1 7.4 6 7.2 11.2-.1 3-1.6 5.6-4.6 7.4" stroke={token("metal-c")} strokeWidth="5.2" {...limb} />
      <circle cx="-12.4" cy="-17.6" r="3" fill={token("metal-a")} />
      <circle cx="12.4" cy="-17.6" r="3" fill={token("metal-a")} />
      <rect x="-3" y="-44" width="6" height="4.6" rx="2" fill={token("steel-3")} />
    </g>
  );
}

const HEADS: Readonly<Record<number, ReactNode>> = {
  1: <rect x="-11" y="-13" width="22" height="19" rx="8" fill={paint("metal")} />,
  2: (
    <>
      <path d="M-11-3a11 10.5 0 0 1 22 0v3a6 6 0 0 1-6 6h-10a6 6 0 0 1-6-6z" fill={paint("metal")} />
      <path d="M0-13.5V-19" stroke={token("metal-c")} strokeWidth="1.4" strokeLinecap="round" />
      <circle cy="-20" r="1.8" fill={token("violet")} />
    </>
  ),
  3: (
    <>
      <rect x="-11" y="-12" width="22" height="18" rx="6" fill={paint("metal")} />
      <rect x="-14.5" y="-6.5" width="4" height="8" rx="2" fill={token("violet")} />
      <rect x="10.5" y="-6.5" width="4" height="8" rx="2" fill={token("violet")} />
    </>
  ),
  4: (
    <>
      <rect x="-11.5" y="-11" width="23" height="17" rx="8.5" fill={paint("metal")} />
      <path d="M-7-10.5C-5-16 5-16 7-10.5" fill={token("steel-3")} />
      <rect x="-6" y="-16.5" width="12" height="2.6" rx="1.3" fill={token("blue")} />
    </>
  ),
};

function Visor() {
  return (
    <g>
      <rect x="-8.2" y="-7.6" width="16.4" height="10.6" rx="4.8" fill={paint("visor")} />
      <circle cx="-3.4" cy="-2.4" r="1.45" fill={token("eye")} />
      <circle cx="3.4" cy="-2.4" r="1.45" fill={token("eye")} />
    </g>
  );
}

const ROOM_IDS = [1, 2, 3, 4];

function Gradient({ id, stops, to = [0, 1] }: { id: string; stops: readonly string[]; to?: readonly [number, number] }) {
  return (
    <linearGradient id={`lms-${id}`} x1="0" y1="0" x2={to[0]} y2={to[1]}>
      {stops.map((name, index) => (
        <stop key={name} offset={index / (stops.length - 1)} stopColor={token(name)} />
      ))}
    </linearGradient>
  );
}

/** The drawing every scene on the map points at. Rendered once, and only when an agent is drawn. */
export function AgentOfficeSprite() {
  return (
    <svg className="lm-scene-sprite" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <Gradient id="floor" stops={["floor-a", "slab-b"]} />
        <Gradient id="wall-left" stops={["wall-left-a", "wall-left-b"]} />
        <Gradient id="wall-right" stops={["wall-right-a", "wall-right-b"]} to={[1, 1]} />
        <Gradient id="sky" stops={["sky-a", "sky-b", "sky-c"]} />
        <Gradient id="metal" stops={["metal-a", "metal-d"]} />
        <Gradient id="metal-dim" stops={["metal-b", "metal-e"]} to={[1, 1]} />
        <Gradient id="visor" stops={["visor-a", "visor-b"]} />
        <Gradient id="screen" stops={["screen-a", "screen-b"]} to={[1, 1]} />
        <Gradient id="desk-top" stops={["steel-4", "steel-5"]} to={[1, 0]} />
        <Gradient id="leaf" stops={["leaf-a", "leaf-b"]} />
        <radialGradient id="lms-glow">
          <stop offset="0" stopColor={token("violet")} stopOpacity="0.5" />
          <stop offset="1" stopColor={token("violet")} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lms-shadow">
          <stop offset="0" stopColor={token("shadow")} stopOpacity="0.75" />
          <stop offset="1" stopColor={token("shadow")} stopOpacity="0" />
        </radialGradient>
        {ROOM_IDS.map((room) => (
          <g key={room} id={`lms-room-${room}`}>
            <Shell />
            {ROOMS[room]}
          </g>
        ))}
        {ROOM_IDS.map((head) => (
          <g key={head} id={`lms-head-${head}`}>
            {HEADS[head]}
            <Visor />
          </g>
        ))}
        <g id="lms-desk">
          <Desk />
        </g>
        <g id="lms-monitor-standby">
          <MonitorStandby />
        </g>
        <g id="lms-monitor-off">
          <Face at={screenFace} fill={token("screen-off")} />
        </g>
        <g id="lms-lamp-on">
          <Lamp shade={token("lamp")} />
        </g>
        <g id="lms-lamp-off">
          <Lamp shade={token("steel-5")} />
        </g>
        <g id="lms-chair">
          <Chair />
        </g>
        <g id="lms-robot">
          <Robot />
        </g>
      </defs>
    </svg>
  );
}

/* The seat, on the room's floor. The robot is drawn 15% above the room's own scale so it reads small. */
const SEAT = iso(46, 62);
const FIGURE = `translate(${SEAT.join(" ")}) scale(1.13)`;

/** One agent's office. `aria-hidden`: it decorates a card whose text already says everything. */
export function AgentOfficeScene({
  nodeId,
  tone,
}: {
  nodeId: string;
  tone?: OfficeTone;
}) {
  const { room, head } = officeVariant(nodeId);
  /* A node with no status claims nothing, so it is drawn as undetermined. */
  const state = tone ?? "indeterminate";
  const seated = state !== "retired";
  const standby = state === "active" || state === "indeterminate";
  const dim = state === "retired" ? 0.68 : state === "suspended" ? 0.86 : undefined;
  return (
    <svg className="lm-scene" viewBox="224 0 202 161" width="202" height="161" aria-hidden="true" focusable="false">
      {/* Mirrored about the room's centre, so the robot sits on the side away from the card's text. */}
      <g transform={`translate(${2 * ORIGIN_X} 0) scale(-1 1)`} opacity={dim}>
        <use href={`#lms-room-${room}`} />
        <use href="#lms-desk" />
        <use href={standby ? "#lms-monitor-standby" : "#lms-monitor-off"} />
        <use href={state === "active" ? "#lms-lamp-on" : "#lms-lamp-off"} />
        <g transform={FIGURE}>
          <use href="#lms-chair" />
          {seated ? (
            <g opacity={state === "indeterminate" ? 0.55 : undefined}>
              <use href="#lms-robot" />
              <use href={`#lms-head-${head}`} y="-51.5" />
            </g>
          ) : null}
        </g>
      </g>
    </svg>
  );
}
