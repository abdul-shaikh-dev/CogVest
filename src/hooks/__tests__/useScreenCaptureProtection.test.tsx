import { renderHook } from "@testing-library/react-native";

import { useScreenCaptureProtection } from "../useScreenCaptureProtection";

function fakeScreenCapture() {
  return {
    allowScreenCaptureAsync: jest.fn(async () => undefined),
    preventScreenCaptureAsync: jest.fn(async () => undefined),
  };
}

describe("useScreenCaptureProtection (#660)", () => {
  it("does nothing while the setting is off", async () => {
    const screenCapture = fakeScreenCapture();

    await renderHook(() => useScreenCaptureProtection(false, screenCapture));

    expect(screenCapture.preventScreenCaptureAsync).not.toHaveBeenCalled();
    expect(screenCapture.allowScreenCaptureAsync).not.toHaveBeenCalled();
  });

  it("blocks capture when turned on and allows it again when turned off", async () => {
    const screenCapture = fakeScreenCapture();
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenCaptureProtection(enabled, screenCapture),
      { initialProps: { enabled: true } },
    );

    expect(screenCapture.preventScreenCaptureAsync).toHaveBeenCalledWith("cogvest-settings");
    await rerender({ enabled: false });
    expect(screenCapture.allowScreenCaptureAsync).toHaveBeenCalledWith("cogvest-settings");
  });

  it("ignores a native failure instead of breaking the app", async () => {
    const screenCapture = fakeScreenCapture();
    screenCapture.preventScreenCaptureAsync.mockRejectedValue(new Error("no activity"));

    await expect(renderHook(() => useScreenCaptureProtection(true, screenCapture))).resolves.toBeTruthy();
  });
});
