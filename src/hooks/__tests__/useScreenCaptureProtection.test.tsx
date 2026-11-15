import { renderHook } from "@testing-library/react-native";

import { setScreenSecureAsync } from "@/modules/cogvest-screen-security";

import { useScreenCaptureProtection } from "../useScreenCaptureProtection";

describe("useScreenCaptureProtection (#660)", () => {
  it("does nothing while the setting is off", async () => {
    const setScreenSecure = jest.fn(async () => undefined);

    await renderHook(() => useScreenCaptureProtection(false, setScreenSecure));

    expect(setScreenSecure).not.toHaveBeenCalled();
  });

  it("blocks capture when turned on and allows it again when turned off", async () => {
    const setScreenSecure = jest.fn(async (_enabled: boolean) => undefined);
    const { rerender } = await renderHook(
      ({ enabled }: { enabled: boolean }) => useScreenCaptureProtection(enabled, setScreenSecure),
      { initialProps: { enabled: true } },
    );

    expect(setScreenSecure).toHaveBeenLastCalledWith(true);
    await rerender({ enabled: false });
    expect(setScreenSecure).toHaveBeenLastCalledWith(false);
  });

  it("ignores a native failure instead of breaking the app", async () => {
    const setScreenSecure = jest.fn(async () => {
      throw new Error("no activity");
    });

    await expect(renderHook(() => useScreenCaptureProtection(true, setScreenSecure))).resolves.toBeTruthy();
  });

  it("is a no-op where the native module is absent", async () => {
    await expect(setScreenSecureAsync(true)).resolves.toBeUndefined();
  });
});
