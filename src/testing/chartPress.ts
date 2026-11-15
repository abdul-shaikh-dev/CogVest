// Test-only driver for Victory chart press state (#673).
//
// jest.setup.ts mocks Reanimated, Worklets and Victory. Those mocks register
// here, so a test can press a rendered chart at a data index and let the
// chart's own animated reactions, derived values and scheduleOnRN callbacks
// run as they would on the UI thread.
import { act } from "@testing-library/react-native";

type Shared<T> = { value: T };

export type MockChartPressState = {
  isActive: Shared<boolean>;
  matchedIndex: Shared<number>;
  x: { position: Shared<number>; value: Shared<number> };
  y: Record<string, { position: Shared<number>; value: Shared<number> }>;
  yIndex: Shared<number>;
};

type Reaction = {
  prepare: () => unknown;
  react: (value: unknown, previous: unknown) => void;
  previous: unknown;
  started: boolean;
};

type Chart = { state: MockChartPressState; rerender: () => void };

const reactions = new Set<Reaction>();
const charts: Chart[] = [];

function shared<T>(value: T): Shared<T> {
  return { value };
}

export function createMockChartPressState(init: { x: number; y: Record<string, number> }): MockChartPressState {
  return {
    isActive: shared(false),
    matchedIndex: shared(-1),
    x: { position: shared(0), value: shared(init.x) },
    y: Object.fromEntries(Object.entries(init.y).map(([key, value]) => [
      key,
      { position: shared(0), value: shared(value) },
    ])),
    yIndex: shared(-1),
  };
}

export function registerMockChart(chart: Chart) {
  charts.push(chart);
  return () => {
    const index = charts.indexOf(chart);
    if (index >= 0) charts.splice(index, 1);
  };
}

/** Mirrors Reanimated: react runs when prepare's result changes, starting with previous = null. */
export function registerMockReaction(reaction: Omit<Reaction, "previous" | "started">) {
  const entry: Reaction = { ...reaction, previous: null, started: false };
  reactions.add(entry);
  runReaction(entry);
  return {
    update(next: Omit<Reaction, "previous" | "started">) {
      entry.prepare = next.prepare;
      entry.react = next.react;
    },
    remove() {
      reactions.delete(entry);
    },
  };
}

function runReaction(reaction: Reaction) {
  const value = reaction.prepare();
  if (reaction.started && Object.is(value, reaction.previous)) return;
  const previous = reaction.previous;
  reaction.previous = value;
  reaction.started = true;
  reaction.react(value, previous);
}

/** The charts currently rendered, in mount order. */
export function mountedChartCount() {
  return charts.length;
}

/**
 * Presses the chart at a data index (or releases it with null), positions
 * the guide at `position`, then runs every registered reaction and re-renders
 * the chart so its derived values see the new state.
 */
export async function pressChartAt(
  index: number | null,
  { chart = charts.length - 1, position = 0 }: { chart?: number; position?: number } = {},
) {
  const target = charts[chart];
  if (!target) throw new Error(`No mounted chart at ${chart}; ${charts.length} mounted.`);
  await act(async () => {
    target.state.isActive.value = index !== null;
    target.state.matchedIndex.value = index ?? -1;
    target.state.x.position.value = position;
    for (const reaction of [...reactions]) runReaction(reaction);
    target.rerender();
  });
}
