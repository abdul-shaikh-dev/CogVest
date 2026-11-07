import { act, renderHook } from "@testing-library/react-native";

import { useProgressiveCount } from "../useProgressiveCount";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it("renders one batch first and adds one batch per task", async () => {
  const { result } = await renderHook(() => useProgressiveCount(60, 24));

  expect(result.current).toBe(24);
  await act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(48);
  await act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(60);
  await act(() => jest.runOnlyPendingTimers());
  expect(result.current).toBe(60);
});

it("renders small lists in full without waiting", async () => {
  // RNTL 14 keeps timers of its own pending, so watch the hook's setTimeout.
  const setTimeoutSpy = jest.spyOn(global, "setTimeout");
  const { result } = await renderHook(() => useProgressiveCount(10, 24));

  expect(result.current).toBe(10);
  expect(setTimeoutSpy).not.toHaveBeenCalled();
  setTimeoutSpy.mockRestore();
});

it("keeps a filtered subset complete after the first fill", async () => {
  const { rerender, result } = await renderHook(({ total }: { total: number }) => useProgressiveCount(total, 24), {
    initialProps: { total: 50 },
  });
  await act(() => jest.advanceTimersByTime(0));
  await act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(50);

  await rerender({ total: 3 });
  expect(result.current).toBe(3);
  await rerender({ total: 50 });
  expect(result.current).toBe(50);
});

it("batches again only when the list grows past what was rendered", async () => {
  const { rerender, result } = await renderHook(({ total }: { total: number }) => useProgressiveCount(total, 24), {
    initialProps: { total: 0 },
  });
  expect(result.current).toBe(0);

  await rerender({ total: 30 });
  expect(result.current).toBe(24);
  await act(() => jest.advanceTimersByTime(0));
  expect(result.current).toBe(30);
});
