import { createStartupLinkCapture, startupLinkToPath } from "../startupLinks";

function createFakeLinking() {
  const handlers = new Set<(event: { url: string }) => void>();
  return {
    addEventListener: jest.fn((_type: "url", handler: (event: { url: string }) => void) => {
      handlers.add(handler);
      return { remove: () => handlers.delete(handler) };
    }),
    emit: (url: string) => handlers.forEach((handler) => handler({ url })),
    listenerCount: () => handlers.size,
  };
}

describe("startup link capture", () => {
  it("returns nothing when no link arrived", () => {
    const linking = createFakeLinking();
    const capture = createStartupLinkCapture(linking);

    expect(capture.finish()).toBeUndefined();
  });

  it("keeps the most recent link that arrived before finishing", () => {
    const linking = createFakeLinking();
    const capture = createStartupLinkCapture(linking);

    linking.emit("cogvest:///holdings");
    linking.emit("cogvest:///settings");

    expect(capture.finish()).toBe("cogvest:///settings");
  });

  it("stops listening once finished so later links are left to the router", () => {
    const linking = createFakeLinking();
    const capture = createStartupLinkCapture(linking);

    expect(linking.listenerCount()).toBe(1);
    capture.finish();
    expect(linking.listenerCount()).toBe(0);

    linking.emit("cogvest:///settings");
    expect(capture.finish()).toBeUndefined();
  });

  it("hands a captured link over only once", () => {
    const linking = createFakeLinking();
    const capture = createStartupLinkCapture(linking);

    linking.emit("cogvest:///settings");

    expect(capture.finish()).toBe("cogvest:///settings");
    expect(capture.finish()).toBeUndefined();
  });
});

describe("startupLinkToPath", () => {
  it.each([
    ["cogvest:///settings", "/settings"],
    ["cogvest-e2e:///visual-qa-seed?token=abc&holdings=30", "/visual-qa-seed?token=abc&holdings=30"],
    ["cogvest://settings", "/settings"],
    ["cogvest:///", "/"],
    ["cogvest://", "/"],
  ])("maps %s to %s", (url, path) => {
    expect(startupLinkToPath(url)).toBe(path);
  });

  it.each(["", "settings", "/settings", "not a link"])(
    "ignores %p because it is not a scheme-qualified link",
    (url) => {
      expect(startupLinkToPath(url)).toBeUndefined();
    },
  );
});
