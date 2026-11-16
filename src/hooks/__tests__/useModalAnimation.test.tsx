import { renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import { useModalAnimation } from "@/src/hooks";

describe("useModalAnimation", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    [false, "fade"],
    [true, "none"],
  ])("with reduced motion %s uses %s (#670)", async (reduced, expected) => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(reduced);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as never);

    const { result } = await renderHook(() => useModalAnimation());

    await waitFor(() => {
      expect(result.current).toBe(expected);
    });
  });
});
