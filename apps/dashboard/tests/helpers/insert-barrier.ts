/**
 * Makes a lost race deterministic instead of timing-dependent.
 *
 * Every handle wrapped by one barrier holds its transaction's INSERT into `table` until `parties`
 * such inserts have been reached. All racers therefore finish their reads (and see the same
 * revision) before any of them writes: one commits, the rest reach the unique index. Without it a
 * slow racer can start after the winner committed and be refused as stale instead, which proves
 * nothing about the lost-race path.
 *
 * Test-only. Everything except that one insert is the real handle.
 */
import type { ControlPlaneDatabase } from "../../src/db/client.server";

type AnyFn = (...args: unknown[]) => unknown;

function passThrough<T extends object>(target: T, override: (property: PropertyKey, value: unknown) => unknown): T {
  return new Proxy(target, {
    get(t, property) {
      const value = Reflect.get(t, property, t) as unknown;
      const replaced = override(property, value);
      if (replaced !== undefined) return replaced;
      return typeof value === "function" ? (value as AnyFn).bind(t) : value;
    },
  });
}

export function createInsertBarrier(table: object, parties: number): { wrap(db: ControlPlaneDatabase): ControlPlaneDatabase } {
  let arrived = 0;
  let open!: () => void;
  const gate = new Promise<void>((resolve) => (open = resolve));
  const arrive = (): Promise<void> => {
    arrived += 1;
    if (arrived === parties) open();
    return gate;
  };

  /* A drizzle builder runs when awaited: hold its `then`, keep every chained builder held too. */
  const held = <T extends object>(builder: T): T =>
    passThrough(builder, (property, value) => {
      if (typeof value !== "function") return undefined;
      if (property === "then") {
        return (onFulfilled: AnyFn, onRejected: AnyFn) => arrive().then(() => (value as AnyFn).call(builder, onFulfilled, onRejected));
      }
      return (...args: unknown[]) => {
        const out = (value as AnyFn).apply(builder, args);
        return out !== null && typeof out === "object" && "then" in out ? held(out) : out;
      };
    });

  const heldTx = (tx: object): object =>
    passThrough(tx, (property, value) =>
      property === "insert"
        ? (target: object, ...rest: unknown[]) => {
            const builder = (value as AnyFn).call(tx, target, ...rest) as object;
            return target === table ? held(builder) : builder;
          }
        : undefined,
    );

  return {
    wrap: (db) =>
      passThrough(db, (property, value) =>
        property === "transaction"
          ? (run: (tx: object) => unknown, ...rest: unknown[]) => (value as AnyFn).call(db, (tx: object) => run(heldTx(tx)), ...rest)
          : undefined,
      ),
  };
}
