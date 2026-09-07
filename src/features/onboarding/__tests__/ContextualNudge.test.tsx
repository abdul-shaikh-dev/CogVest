import { act, fireEvent, render } from "@testing-library/react-native";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, portfolioStorageKey } from "@/src/store";
import { ContextualNudge } from "../ContextualNudge";

function fixture() {
  const storage = createMemoryJsonStorage();
  return { storage, store: createPortfolioStore({ storage }) };
}

describe("Contextual guidance", () => {
  it.each(["metadata", "minimal", "insights"] as const)(
    "dismisses %s and stays dismissed after remount and hydration",
    (kind) => {
      const { store, storage } = fixture();
      const view = render(<ContextualNudge kind={kind} store={store} />);
      expect(view.getByTestId(`nudge-${kind}`)).toBeTruthy();
      fireEvent.press(view.getByTestId(`dismiss-nudge-${kind}`));
      expect(view.queryByTestId(`nudge-${kind}`)).toBeNull();
      view.unmount();
      const restored = createPortfolioStore({ storage });
      const next = render(<ContextualNudge kind={kind} store={restored} />);
      expect(next.queryByTestId(`nudge-${kind}`)).toBeNull();
      expect(restored.getState().preferences.nudgeVersions?.[kind]).toBe(1);
    },
  );

  it("migrates older preferences without changing records and resets with app data", () => {
    const { store, storage } = fixture();
    store.getState().updatePreferences({ maskWealthValues: true });
    const restored = createPortfolioStore({ storage });
    expect(restored.getState().storageRecovery).toBeUndefined();
    const view = render(<ContextualNudge kind="metadata" store={restored} />);
    fireEvent.press(view.getByTestId("dismiss-nudge-metadata"));
    expect(restored.getState().preferences.maskWealthValues).toBe(true);
    expect(restored.getState().trades).toEqual([]);
    storage.removeItem(portfolioStorageKey);
    expect(
      createPortfolioStore({ storage }).getState().preferences.nudgeVersions,
    ).toBeUndefined();
  });

  it("never downgrades acknowledged content versions or loses other dismissals", () => {
    const { store } = fixture();
    store.getState().acknowledgeNudge("metadata", 2);
    store.getState().acknowledgeNudge("metadata", 1);
    store.getState().acknowledgeNudge("insights", 1);
    store.getState().acknowledgeNudge("minimal", NaN);
    expect(store.getState().preferences.nudgeVersions).toEqual({
      metadata: 2,
      insights: 1,
    });
    expect(
      render(<ContextualNudge kind="metadata" store={store} />).queryByTestId(
        "nudge-metadata",
      ),
    ).toBeNull();
  });

  it("ignores malformed optional guidance state without blocking portfolio recovery", () => {
    const storage = createMemoryJsonStorage({
      [portfolioStorageKey]: {
        schemaVersion: 8,
        preferences: {
          nudgeVersions: { metadata: -1, minimal: 1, insights: "invalid" },
        },
      },
    });
    const store = createPortfolioStore({ storage });
    expect(store.getState().storageRecovery).toBeUndefined();
    expect(store.getState().preferences.nudgeVersions).toEqual({
      metadata: undefined,
      minimal: 1,
      insights: undefined,
    });
    expect(
      render(<ContextualNudge kind="metadata" store={store} />).getByTestId(
        "nudge-metadata",
      ),
    ).toBeTruthy();
  });

  it("cannot overwrite financial data awaiting storage recovery", () => {
    const storage = createMemoryJsonStorage();
    storage.setRawItem(portfolioStorageKey, "corrupted financial records");
    const store = createPortfolioStore({ storage });
    expect(store.getState().storageRecovery).toBeDefined();
    const before = storage.getRawItem(portfolioStorageKey);
    expect(() => store.getState().acknowledgeNudge("metadata", 1)).toThrow(
      /recovery/,
    );
    expect(storage.getRawItem(portfolioStorageKey)).toBe(before);
  });

  it("suppresses guidance for entered fields without treating unsaved drafts as completion", () => {
    const { store } = fixture();
    const view = render(
      <ContextualNudge kind="metadata" store={store} hasConviction />,
    );
    expect(view.queryByText(/Conviction records/)).toBeNull();
    expect(view.getByText(/A holding plan records/)).toBeTruthy();
    view.rerender(
      <ContextualNudge kind="metadata" store={store} hasConviction hasPlan />,
    );
    expect(view.queryByTestId("nudge-metadata")).toBeNull();
    expect(store.getState().preferences.nudgeVersions).toBeUndefined();
    view.rerender(<ContextualNudge kind="metadata" store={store} />);
    expect(view.getByTestId("nudge-metadata")).toBeTruthy();
  });

  it("completes metadata guidance from saved buy records and retains completion after correction", () => {
    const { store, storage } = fixture();
    store
      .getState()
      .addAsset({
        id: "a",
        name: "Example",
        symbol: "EX",
        ticker: "EX.NS",
        assetClass: "stock",
        currency: "INR",
      });
    store
      .getState()
      .addTrade({
        id: "b",
        assetId: "a",
        type: "buy",
        date: "2026-08-01",
        quantity: 1,
        pricePerUnit: 100,
        totalValue: 100,
        conviction: 4,
        intendedHoldDays: 365,
      });
    const view = render(<ContextualNudge kind="metadata" store={store} />);
    expect(view.queryByTestId("nudge-metadata")).toBeNull();
    expect(
      createPortfolioStore({ storage }).getState().preferences.nudgeVersions
        ?.metadata,
    ).toBe(1);
    act(() => store.setState({ trades: [] }));
    expect(view.queryByTestId("nudge-metadata")).toBeNull();
  });

  it.each(["metadata", "minimal", "insights"] as const)(
    "does not show %s in Minimal Mode",
    (kind) => {
      const { store, storage } = fixture();
      store.getState().updatePreferences({ displayMode: "minimal" });
      const view = render(<ContextualNudge kind={kind} store={store} />);
      expect(view.queryByTestId(`nudge-${kind}`)).toBeNull();
      if (kind === "minimal") {
        act(() =>
          store.getState().updatePreferences({ displayMode: "standard" }),
        );
        expect(view.queryByTestId("nudge-minimal")).toBeNull();
        expect(
          createPortfolioStore({ storage }).getState().preferences.nudgeVersions
            ?.minimal,
        ).toBe(1);
      }
    },
  );

  it("handles storage failure without claiming persistence or blocking local dismissal", () => {
    const { store, storage } = fixture();
    const write = jest.spyOn(storage, "setItem").mockImplementation(() => {
      throw new Error("disk full");
    });
    const view = render(<ContextualNudge kind="metadata" store={store} />);
    fireEvent.press(view.getByTestId("dismiss-nudge-metadata"));
    expect(view.getByText(/Could not save/)).toBeTruthy();
    expect(store.getState().preferences.nudgeVersions).toBeUndefined();
    fireEvent.press(view.getByText("Hide for now"));
    expect(view.queryByTestId("nudge-metadata")).toBeNull();
    write.mockRestore();
  });
});
