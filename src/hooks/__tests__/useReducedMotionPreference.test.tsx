import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useReducedMotionPreference } from "@/src/hooks";

describe("useReducedMotionPreference", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the current OS reduced-motion preference", async () => {
    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
      remove: jest.fn(),
    } as never);

    // RNTL 14 awaits the OS answer during render, so record every value.
    const seen: boolean[] = [];
    const { result } = await renderHook(() => {
      const value = useReducedMotionPreference();
      seen.push(value);
      return value;
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    expect(seen[0]).toBe(false);
  });

  it("updates when the OS reduced-motion preference changes", async () => {
    let listener: (value: boolean) => void = () => {};

    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, "addEventListener")
      .mockImplementation((_eventName, callback) => {
        listener = callback as unknown as (value: boolean) => void;

        return { remove: jest.fn() } as never;
      });

    const { result } = await renderHook(() => useReducedMotionPreference());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });

    await act(() => {
      listener(true);
    });

    expect(result.current).toBe(true);
  });

  it("removes the reduced-motion listener on unmount", async () => {
    const remove = jest.fn();

    jest
      .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
      .mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({
      remove,
    } as never);

    const { unmount } = await renderHook(() => useReducedMotionPreference());

    await unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
