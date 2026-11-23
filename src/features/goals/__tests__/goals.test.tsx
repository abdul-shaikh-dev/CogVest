import { fireEvent, render, renderHook } from "@testing-library/react-native";

import { useDashboard } from "@/src/features/dashboard/useDashboard";
import type { SavingsGoalInput } from "@/src/store";
import { createEpfReportingFixture, epfReportingDate } from "@/src/testing/epfReportingFixture";

import { buildGoalInput, goalDraftFrom } from "../goalForm";
import { GoalScreen } from "../GoalScreen";
import { GoalsSection } from "../GoalsSection";
import { useSavingsGoals } from "../useSavingsGoals";

const now = epfReportingDate;
const house: SavingsGoalInput = {
  assumedAnnualReturnPct: 10, id: "goal-house", name: "House", scope: { kind: "portfolio" },
  targetAmountInr: 1_000_000, targetDate: "2031-10-05",
};

describe("savings goal values (#767)", () => {
  it("counts the Dashboard portfolio value for a whole-portfolio goal", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveSavingsGoal(house);
    const dashboard = (await renderHook(() => useDashboard({ now, store }))).result.current;
    const goals = (await renderHook(() => useSavingsGoals({ now, store }))).result.current;

    expect(dashboard.totalValue).toBe(200_000);
    expect(goals.goals[0].progress).toMatchObject({ currentValueInr: 200_000, reachedPct: 20, status: "inProgress" });
  });

  it("adds only the chosen holding and accounts", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveSavingsGoal({ ...house, scope: {
      assetIds: ["debt"], epfAccountIds: ["epf"], includeCash: false, kind: "selected", ppfAccountIds: [],
    } });
    const goals = (await renderHook(() => useSavingsGoals({ now, store }))).result.current;

    expect(goals.goals[0].progress.currentValueInr).toBe(150_000);
  });
});

describe("Goals on Progress (#767)", () => {
  it("shows progress in words, the monthly estimate, overlap notes, and opens goals", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveSavingsGoal(house);
    store.getState().saveSavingsGoal({ ...house, id: "goal-car", name: "Car", targetAmountInr: 100_000 });
    const onOpenGoal = jest.fn();
    const screen = await render(<GoalsSection now={now} onOpenGoal={onOpenGoal} store={store} />);

    expect(screen.getByTestId("goal-reached-goal-house")).toHaveTextContent("20% reached");
    expect(screen.getByTestId("goal-status-goal-house")).toHaveTextContent("About ₹8,855 a month needed · estimate at 10% a year");
    expect(screen.getByTestId("goal-status-goal-car")).toHaveTextContent("Target reached.");
    expect(screen.getByTestId("goal-overlap-goal-house")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("goal-card-goal-car"));
    expect(onOpenGoal).toHaveBeenCalledWith("goal-car");
    await fireEvent.press(screen.getByTestId("goals-add"));
    expect(onOpenGoal).toHaveBeenLastCalledWith();
  });

  it("hides amounts when values are masked", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveSavingsGoal(house);
    store.getState().updatePreferences({ maskWealthValues: true });
    const screen = await render(<GoalsSection now={now} onOpenGoal={jest.fn()} store={store} />);

    expect(screen.getByTestId("goal-value-goal-house").props.accessibilityLabel).toBe("Amount hidden");
    expect(screen.getByTestId("goal-status-goal-house")).toHaveTextContent(/^About ₹•+ a month needed/u);
    expect(screen.queryByText(/₹2\.00L/u)).toBeNull();
  });

  it("stays folded in Minimal Mode until opened", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveSavingsGoal(house);
    store.getState().updatePreferences({ displayMode: "minimal" });
    const screen = await render(<GoalsSection now={now} onOpenGoal={jest.fn()} store={store} />);

    expect(screen.queryByTestId("goal-card-goal-house")).toBeNull();
    await fireEvent.press(screen.getByTestId("goals-toggle"));
    expect(screen.getByTestId("goal-card-goal-house")).toBeTruthy();
  });
});

describe("Goal screen (#767)", () => {
  it("creates a goal from chosen accounts and shows field errors first", async () => {
    const store = createEpfReportingFixture();
    const onBack = jest.fn();
    const screen = await render(<GoalScreen now={now} onBack={onBack} store={store} />);

    await fireEvent.press(screen.getByTestId("goal-save"));
    expect(screen.getByText("Enter a name of up to 60 characters.")).toBeTruthy();
    expect(store.getState().savingsGoals).toEqual([]);

    await fireEvent.changeText(screen.getByTestId("goal-name"), "Retirement");
    await fireEvent.changeText(screen.getByTestId("goal-target-amount"), "5000000");
    await fireEvent.press(screen.getByTestId("goal-target-date"));
    await fireEvent(screen.getByTestId("goal-target-date-picker"), "onChange", {
      nativeEvent: { timestamp: new Date(2046, 9, 5, 12).getTime() }, type: "set",
    });
    await fireEvent.changeText(screen.getByTestId("goal-return"), "8.5");
    await fireEvent.press(screen.getByTestId("goal-scope-picker"));
    await fireEvent.press(screen.getByTestId("goal-scope-selected"));
    await fireEvent.press(screen.getByTestId("goal-save"));
    expect(screen.getByTestId("goal-scope-error")).toHaveTextContent("Choose at least one holding or account.");

    await fireEvent.press(screen.getByTestId("goal-scope-ppf-ppf"));
    await fireEvent.press(screen.getByTestId("goal-scope-epf-epf"));
    await fireEvent.press(screen.getByTestId("goal-save"));

    expect(onBack).toHaveBeenCalled();
    expect(store.getState().savingsGoals).toEqual([expect.objectContaining({
      assumedAnnualReturnPct: 8.5, name: "Retirement", targetAmountInr: 5_000_000, targetDate: "2046-10-05",
      scope: { assetIds: [], epfAccountIds: ["epf"], includeCash: false, kind: "selected", ppfAccountIds: ["ppf"] },
    })]);
  });

  it("shows a saved goal's progress and deletes only after a second tap", async () => {
    const store = createEpfReportingFixture();
    store.getState().saveSavingsGoal(house);
    const onBack = jest.fn();
    const screen = await render(<GoalScreen goalId="goal-house" now={now} onBack={onBack} store={store} />);

    expect(screen.getByTestId("goal-summary-value").props.accessibilityLabel).toBe("₹2,00,000.00");
    expect(screen.getByTestId("goal-summary-status")).toHaveTextContent(/estimate at 10% a year/u);
    expect(screen.getByTestId("goal-summary-projection")).toHaveTextContent(/without more investment\.$/u);
    await fireEvent.press(screen.getByTestId("goal-delete"));
    expect(store.getState().savingsGoals).toHaveLength(1);
    await fireEvent.press(screen.getByTestId("goal-delete"));
    expect(store.getState().savingsGoals).toEqual([]);
    expect(onBack).toHaveBeenCalled();
  });
});

describe("goal form (#767)", () => {
  const draft = { ...goalDraftFrom(undefined), assumedReturn: "7", name: "Trip", targetAmount: "200000", targetDate: "2027-01-01" };

  it("requires a return the user typed, and a future date for a new or changed target", () => {
    expect(buildGoalInput({ ...draft, assumedReturn: "" }, { id: "g", today: "2026-11-24" }))
      .toMatchObject({ errors: { assumedReturn: expect.any(String) }, ok: false });
    expect(buildGoalInput({ ...draft, targetDate: "2026-11-24" }, { id: "g", today: "2026-11-24" }))
      .toEqual({ errors: { targetDate: "Choose a date after today." }, ok: false });
    expect(buildGoalInput({ ...draft, targetDate: "2026-01-01" }, { id: "g", savedTargetDate: "2026-01-01", today: "2026-11-24" }).ok)
      .toBe(true);
    expect(buildGoalInput({ ...draft, targetAmount: "1e6" }, { id: "g", today: "2026-11-24" }))
      .toMatchObject({ errors: { targetAmount: expect.any(String) } });
  });
});
