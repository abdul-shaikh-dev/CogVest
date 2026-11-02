import { act, renderHook } from "@testing-library/react-native";

import { useProgressiveCount } from "../useProgressiveCount";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it("renders one batch first and adds one batch per task", () => {
  const { result } = renderHook(() => useProgressiveCount(60, 24));

  expect(result.current).toBe(24);
  act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(48);
  act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(60);
  act(() => jest.runOnlyPendingTimers());
  expect(result.current).toBe(60);
});

it("renders small lists in full without waiting", () => {
  const { result } = renderHook(() => useProgressiveCount(10, 24));

  expect(result.current).toBe(10);
  expect(jest.getTimerCount()).toBe(0);
});

it("keeps a filtered subset complete after the first fill", () => {
  const { rerender, result } = renderHook(({ total }: { total: number }) => useProgressiveCount(total, 24), {
    initialProps: { total: 50 },
  });
  act(() => jest.advanceTimersByTime(0));
  act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(50);

  rerender({ total: 3 });
  expect(result.current).toBe(3);
  rerender({ total: 50 });
  expect(result.current).toBe(50);
});

it("batches again only when the list grows past what was rendered", () => {
  const { rerender, result } = renderHook(({ total }: { total: number }) => useProgressiveCount(total, 24), {
    initialProps: { total: 0 },
  });
  expect(result.current).toBe(0);

  rerender({ total: 30 });
  expect(result.current).toBe(24);
  act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(30);
});
