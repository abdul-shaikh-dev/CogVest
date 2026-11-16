import { fireEvent, render } from "@testing-library/react-native";
import { ScrollView } from "react-native";
import { AppButton } from "@/src/components/common";

import { RecoveryScreen } from "../RecoveryScreen";
import { getAllByComponentType, getByComponentType } from "@/src/testing/componentQueries";

const exportProps = { hasRecoveryCopies: false, onExport: jest.fn() };

describe("RecoveryScreen", () => {
  it("keeps long recovery content scrollable and puts the safe action first", async () => {
    const screen = await render(
      <RecoveryScreen {...exportProps} affectedAreas={["Monthly snapshots and historical valuation evidence"]} onReset={jest.fn()} recoveryCopiesPreserved />,
    );
    expect(getByComponentType(screen, ScrollView)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("start-storage-reset"));
    const buttons = getAllByComponentType(screen, AppButton);
    expect(buttons.map((button) => button.props.title)).toEqual(["Keep data", "Reset and continue"]);
    expect(buttons[0].props.variant).toBeUndefined();
    expect(buttons[1].props.variant).toBe("destructive");
  });
  it("requires confirmation before resetting affected data", async () => {
    const onReset = jest.fn();
    const { getByTestId, getByText, queryByTestId } = await render(
      <RecoveryScreen
        {...exportProps}
        affectedAreas={["Portfolio records"]}
        onReset={onReset}
        recoveryCopiesPreserved
      />,
    );

    expect(getByText("Your original data was preserved")).toBeTruthy();
    expect(getByText("Portfolio records")).toBeTruthy();
    expect(queryByTestId("confirm-storage-reset")).toBeNull();

    await fireEvent.press(getByTestId("start-storage-reset"));

    expect(getByTestId("confirm-storage-reset")).toBeTruthy();
    expect(onReset).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId("cancel-storage-reset"));

    expect(queryByTestId("confirm-storage-reset")).toBeNull();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("resets only after explicit confirmation", async () => {
    const onReset = jest.fn();
    const { getByTestId } = await render(
      <RecoveryScreen
        {...exportProps}
        affectedAreas={["Portfolio records", "Current quote cache"]}
        onReset={onReset}
        recoveryCopiesPreserved
      />,
    );

    await fireEvent.press(getByTestId("start-storage-reset"));
    await fireEvent.press(getByTestId("confirm-storage-reset"));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("does not offer reset when a recovery copy could not be preserved", async () => {
    const { getByText, queryByTestId } = await render(
      <RecoveryScreen
        {...exportProps}
        affectedAreas={["Portfolio records"]}
        onReset={jest.fn()}
        recoveryCopiesPreserved={false}
      />,
    );

    expect(
      getByText("CogVest stopped before overwriting your data"),
    ).toBeTruthy();
    expect(queryByTestId("start-storage-reset")).toBeNull();
  });

  it("exports the recovery copies and says which files it saved (#654)", async () => {
    const onExport = jest.fn().mockResolvedValue(["CogVest-recovery-a.txt", "CogVest-recovery-b.txt"]);
    const screen = await render(
      <RecoveryScreen affectedAreas={["Portfolio records"]} hasRecoveryCopies onExport={onExport} onReset={jest.fn()} recoveryCopiesPreserved />,
    );

    await fireEvent.press(screen.getByTestId("export-recovery-copies"));

    expect(onExport).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("export-recovery-copies-status").props.children)
      .toBe("Saved 2 recovery files: CogVest-recovery-a.txt, CogVest-recovery-b.txt.");
  });

  it("shows an export failure and keeps reset available", async () => {
    const onExport = jest.fn().mockRejectedValue(new Error("Recovery copies could not be saved."));
    const screen = await render(
      <RecoveryScreen affectedAreas={["Portfolio records"]} hasRecoveryCopies onExport={onExport} onReset={jest.fn()} recoveryCopiesPreserved />,
    );

    await fireEvent.press(screen.getByTestId("export-recovery-copies"));

    expect(screen.getByTestId("export-recovery-copies-status").props.children).toBe("Recovery copies could not be saved.");
    expect(screen.getByTestId("start-storage-reset")).toBeTruthy();
  });

  it("offers no export without a kept copy", async () => {
    const screen = await render(
      <RecoveryScreen {...exportProps} affectedAreas={["Portfolio records"]} onReset={jest.fn()} recoveryCopiesPreserved={false} />,
    );
    expect(screen.queryByTestId("export-recovery-copies")).toBeNull();
  });
});
