import { act, renderHook } from "@testing-library/react-native";
import { createStore } from "zustand/vanilla";

import { shallowEqual, usePortfolioFields, usePortfolioSlice } from "@/src/hooks";

type State = { a: number[]; b: string; c: { n: number } };

function testStore() {
  return createStore<State>(() => ({ a: [1], b: "x", c: { n: 1 } }));
}

describe("shallowEqual", () => {
  it.each([
    [{ a: 1, b: "x" }, { a: 1, b: "x" }, true],
    [{ a: 1 }, { a: 2 }, false],
    [{ a: 1 }, { a: 1, b: 2 }, false],
    [{ a: 1, b: undefined }, { a: 1, c: undefined }, false],
    [{ a: [1] }, { a: [1] }, false],
    [Number.NaN, Number.NaN, true],
    [null, {}, false],
    ["x", "x", true],
  ])("compares %p and %p as %p", (left, right, expected) => {
    expect(shallowEqual<unknown>(left, right)).toBe(expected);
  });
});

describe("usePortfolioSlice (#662)", () => {
  it("re-renders only when a selected field changes", async () => {
    const store = testStore();
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return usePortfolioFields(store, ["a", "b"]);
    });
    const first = result.current;
    expect(renders).toBe(1);

    await act(async () => store.setState({ c: { n: 2 } }));
    expect(renders).toBe(1);
    expect(result.current).toBe(first);

    await act(async () => store.setState({ b: "y" }));
    expect(renders).toBe(2);
    expect(result.current).toEqual({ a: [1], b: "y" });
    expect(result.current.a).toBe(first.a);
  });

  it("uses the equality function it is given", async () => {
    const store = testStore();
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return usePortfolioSlice(store, (state) => state.c, (left, right) => left.n === right.n);
    });
    const first = result.current;

    await act(async () => store.setState({ c: { n: 1 } }));
    expect(renders).toBe(1);
    expect(result.current).toBe(first);

    await act(async () => store.setState({ c: { n: 3 } }));
    expect(renders).toBe(2);
    expect(result.current.n).toBe(3);
  });

  it("reads the new selection when the selector changes", async () => {
    const store = testStore();
    const { rerender, result } = await renderHook(
      ({ key }: { key: "a" | "b" }) => usePortfolioSlice(store, (state) => state[key], Object.is),
      { initialProps: { key: "b" as "a" | "b" } },
    );
    expect(result.current).toBe("x");

    await rerender({ key: "a" });
    expect(result.current).toEqual([1]);
  });
});
