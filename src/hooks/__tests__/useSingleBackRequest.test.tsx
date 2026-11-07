import { renderHook } from "@testing-library/react-native";

import {
  DUPLICATE_BACK_REQUEST_MS,
  useSingleBackRequest,
} from "@/src/hooks/useSingleBackRequest";

describe("useSingleBackRequest", () => {
  afterEach(() => jest.restoreAllMocks());

  async function setup() {
    const clock = jest.spyOn(Date, "now").mockReturnValue(10_000);
    const handler = jest.fn();
    const { result, rerender } = await renderHook(
      ({ onBack }: { onBack: () => void }) => useSingleBackRequest(onBack),
      { initialProps: { onBack: handler } },
    );
    return {
      handler,
      press: () => result.current(),
      rerender,
      setNow: (value: number) => clock.mockReturnValue(value),
    };
  }

  it("runs the handler once when one press arrives twice", async () => {
    const { handler, press, setNow } = await setup();
    press();
    setNow(10_041);
    press();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs the handler again for a separate press", async () => {
    const { handler, press, setNow } = await setup();
    press();
    setNow(10_000 + DUPLICATE_BACK_REQUEST_MS);
    press();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("calls the latest handler without changing the returned callback", async () => {
    const { handler, press, rerender, setNow } = await setup();
    const latest = jest.fn();
    await rerender({ onBack: latest });
    setNow(20_000);
    press();
    expect(handler).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });
});
