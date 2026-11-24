import { act, fireEvent, render } from "@testing-library/react-native";

import { DashboardScreen } from "@/src/features/dashboard";
import { createEpfReportingFixture, epfReportingDate } from "@/src/testing/epfReportingFixture";

import { AllocationTargetsScreen } from "../AllocationTargetsScreen";
import { buildAllocationTargets, targetDraftFrom, targetTotalText } from "../targetForm";
import { gapText } from "../targetViewModel";

jest.mock("@/modules/cogvest-widget", () => ({ setWidgetSnapshotAsync: jest.fn(async () => undefined) }));

// The fixture is ₹2,00,000, all Debt: a debt holding, PPF and EPF.
const now = epfReportingDate;

describe("target allocation on the Dashboard (#764)", () => {
  it("shows nothing until targets are set, then the gap and the new money in words", async () => {
    const store = createEpfReportingFixture();
    const screen = await render(<DashboardScreen now={now} store={store} />);
    expect(screen.queryByTestId("dashboard-targets")).toBeNull();

    await act(async () => store.getState().saveAllocationTargets({ cash: 0, crypto: 0, debt: 50, equity: 50 }));
    expect(screen.getByTestId("dashboard-target-equity")).toHaveTextContent("Equity0% · target 50% · 50 points below");
    expect(screen.getByTestId("dashboard-target-debt")).toHaveTextContent("Debt100% · target 50% · 50 points above");
    expect(screen.getByTestId("dashboard-target-cash")).toHaveTextContent("Cash0% · target 0% · on target");
    expect(screen.getByTestId("dashboard-targets-new-money"))
      .toHaveTextContent("About ₹2,00,000 of new money would bring every class to its target without selling. By class:");
    expect(screen.getByTestId("dashboard-target-new-money-equity").props.accessibilityLabel).toBe("₹2,00,000.00");
    expect(screen.queryByTestId("dashboard-target-new-money-debt")).toBeNull();
    expect(screen.queryByText(/\b(buy|sell)\b/iu)).toBeNull();
  });

  it("hides amounts when masked and folds away in Minimal Mode", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveAllocationTargets({ cash: 0, crypto: 0, debt: 50, equity: 50 });
    store.getState().updatePreferences({ displayMode: "minimal", maskWealthValues: true });
    const screen = await render(<DashboardScreen now={now} store={store} />);

    expect(screen.queryByTestId("dashboard-target-equity")).toBeNull();
    await fireEvent.press(screen.getByTestId("dashboard-targets-toggle"));
    expect(screen.getByTestId("dashboard-target-equity")).toBeTruthy();
    expect(screen.getByTestId("dashboard-targets-new-money")).toHaveTextContent(/^About ₹•+ of new money/u);
    expect(screen.getByTestId("dashboard-target-new-money-equity").props.accessibilityLabel).toBe("Amount hidden");
  });

  it("explains when a 0% class blocks reaching the targets with new money", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveAllocationTargets({ cash: 0, crypto: 0, debt: 0, equity: 100 });
    const screen = await render(<DashboardScreen now={now} store={store} />);
    expect(screen.getByTestId("dashboard-targets-new-money"))
      .toHaveTextContent("Debt holds money but has a 0% target, so new money alone cannot match these targets.");
  });
});

describe("target allocation editor (#764)", () => {
  it("saves only a mix that adds up to 100%, and removes it", async () => {
    const store = createEpfReportingFixture();
    const onBack = jest.fn();
    const screen = await render(<AllocationTargetsScreen onBack={onBack} store={store} />);

    await fireEvent.changeText(screen.getByTestId("allocation-target-equity"), "60");
    await fireEvent.changeText(screen.getByTestId("allocation-target-debt"), "30");
    expect(screen.getByTestId("allocation-target-total")).toHaveTextContent("Total 90% · 10% left to assign");
    await fireEvent.press(screen.getByTestId("allocation-target-save"));
    expect(screen.getByTestId("allocation-target-error")).toHaveTextContent("Make the targets add up to 100% to save them.");
    expect(store.getState().preferences.allocationTargets).toBeUndefined();

    await fireEvent.changeText(screen.getByTestId("allocation-target-cash"), "10");
    expect(screen.getByTestId("allocation-target-total")).toHaveTextContent("Total 100%");
    await fireEvent.press(screen.getByTestId("allocation-target-save"));
    expect(store.getState().preferences.allocationTargets).toEqual({ cash: 10, crypto: 0, debt: 30, equity: 60 });
    expect(onBack).toHaveBeenCalledTimes(1);

    const editor = await render(<AllocationTargetsScreen onBack={onBack} store={store} />);
    expect(editor.getByTestId("allocation-target-equity").props.value).toBe("60");
    await fireEvent.press(editor.getByTestId("allocation-target-clear"));
    expect(store.getState().preferences).not.toHaveProperty("allocationTargets");
  });

  it("checks each field and words the total and gaps", () => {
    const draft = { ...targetDraftFrom(undefined), equity: "100" };
    expect(buildAllocationTargets(draft)).toEqual({ ok: true, targets: { cash: 0, crypto: 0, debt: 0, equity: 100 } });
    expect(buildAllocationTargets({ ...draft, equity: "99.95", cash: "0.05" }))
      .toMatchObject({ errors: { cash: expect.any(String), equity: expect.any(String) }, ok: false });
    expect(buildAllocationTargets({ ...draft, equity: "1e2" })).toMatchObject({ errors: { equity: expect.any(String) } });
    expect(targetTotalText(112.5)).toBe("Total 112.5% · 12.5% over 100%");
    expect(targetTotalText(null)).toBe("Enter numbers only.");
    expect(gapText(-1)).toBe("1 point below");
    expect(gapText(2.5)).toBe("2.5 points above");
  });
});
