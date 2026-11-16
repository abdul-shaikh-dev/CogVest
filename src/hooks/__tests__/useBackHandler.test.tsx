import { renderHook } from "@testing-library/react-native";
import { BackHandler } from "react-native";

import { useBackHandler } from "@/src/hooks";

describe("useBackHandler (#666)", () => {
  it("registers once, calls the latest handler and consumes the press", async () => {
    const remove = jest.fn();
    const add = jest.spyOn(BackHandler, "addEventListener").mockReturnValue({ remove });
    const first = jest.fn();
    const second = jest.fn();
    const { rerender, unmount } = await renderHook(({ handler }: { handler: () => void }) => useBackHandler(handler), {
      initialProps: { handler: first },
    });

    await rerender({ handler: second });

    expect(add).toHaveBeenCalledTimes(1);
    expect((add.mock.calls[0][1] as () => boolean)()).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });

  it("adds no listener while disabled and removes it when disabled", async () => {
    const remove = jest.fn();
    const add = jest.spyOn(BackHandler, "addEventListener").mockReturnValue({ remove });
    const { rerender } = await renderHook(({ enabled }: { enabled: boolean }) => useBackHandler(jest.fn(), enabled), {
      initialProps: { enabled: false },
    });
    expect(add).not.toHaveBeenCalled();

    await rerender({ enabled: true });
    await rerender({ enabled: false });

    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    add.mockRestore();
  });
});
