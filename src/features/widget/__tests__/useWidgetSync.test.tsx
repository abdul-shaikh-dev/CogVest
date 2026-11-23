import { renderHook } from "@testing-library/react-native";

import type { WidgetSnapshot } from "@/modules/cogvest-widget";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createAppLockStore } from "@/src/services/security/appLock";
import { createPortfolioStore } from "@/src/store";

import { useDashboardWidgetSync, useWidgetPrivacySync } from "../useWidgetSync";
import type { WidgetDashboard } from "../widgetSnapshot";

const dashboard: WidgetDashboard = {
  dayChange: { absolute: 0, percentage: 0 },
  hasPortfolioRecords: true,
  holdings: [],
  quoteFreshness: { current: 0, manual: 0, missing: 0, stale: 0, status: "empty", total: 0 },
  totalValue: 50_000,
};

describe("widget sync (#786)", () => {
  it("hides the widget as soon as masking turns on", async () => {
    const setSnapshot = jest.fn(async (_snapshot: WidgetSnapshot) => undefined);
    const privacy = { appLockEnabled: false, maskWealthValues: false, showWidgetValue: true };
    const hook = await renderHook((props: typeof privacy) => useWidgetPrivacySync(props, setSnapshot), { initialProps: privacy });
    expect(setSnapshot).not.toHaveBeenCalled();

    await hook.rerender({ ...privacy, maskWealthValues: true });
    expect(setSnapshot).toHaveBeenCalledWith({ kind: "hidden" });
  });

  it("sends the value once, not on every render, and again after it was hidden", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const setSnapshot = jest.fn(async (_snapshot: WidgetSnapshot) => undefined);
    const appLockStore = createAppLockStore({ storage: createMemoryJsonStorage() });
    const props = { appLockStore, dashboard, hasCompleteValuation: true, maskWealthValues: false, now: new Date(2026, 10, 23), setSnapshot, showWidgetValue: true, store };
    const hook = await renderHook((input: typeof props) => useDashboardWidgetSync(input), { initialProps: props });

    expect(setSnapshot).toHaveBeenCalledTimes(1);
    expect(setSnapshot).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "value", value: "₹50K" }));

    await hook.rerender({ ...props });
    expect(setSnapshot).toHaveBeenCalledTimes(1);

    await hook.rerender({ ...props, maskWealthValues: true });
    // Hiding is the root layout's job; this hook sends nothing while hidden.
    expect(setSnapshot).toHaveBeenCalledTimes(1);

    await hook.rerender({ ...props });
    expect(setSnapshot).toHaveBeenCalledTimes(2);
  });

  it("never sends a value before the user opts in", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const setSnapshot = jest.fn(async (_snapshot: WidgetSnapshot) => undefined);
    await renderHook(() => useDashboardWidgetSync({
      appLockStore: createAppLockStore({ storage: createMemoryJsonStorage() }), dashboard, hasCompleteValuation: true, maskWealthValues: false, now: new Date(), setSnapshot, showWidgetValue: false, store,
    }));
    expect(setSnapshot).not.toHaveBeenCalled();
  });

  it("stays hidden when the screen was given no App lock store", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const setSnapshot = jest.fn(async (_snapshot: WidgetSnapshot) => undefined);
    await renderHook(() => useDashboardWidgetSync({
      appLockStore: undefined, dashboard, hasCompleteValuation: true, maskWealthValues: false, now: new Date(), setSnapshot, showWidgetValue: true, store,
    }));
    expect(setSnapshot).not.toHaveBeenCalled();
  });
});
