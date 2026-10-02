import { fireEvent, render } from "@testing-library/react-native";
import { ScrollView } from "react-native";
import { AppButton } from "@/src/components/common";

import { RecoveryScreen } from "../RecoveryScreen";

describe("RecoveryScreen", () => {
  it("keeps long recovery content scrollable and puts the safe action first", () => {
    const screen = render(
      <RecoveryScreen affectedAreas={["Monthly snapshots and historical valuation evidence"]} onReset={jest.fn()} recoveryCopiesPreserved />,
    );
    expect(screen.UNSAFE_getByType(ScrollView)).toBeTruthy();
    fireEvent.press(screen.getByTestId("start-storage-reset"));
    const buttons = screen.UNSAFE_getAllByType(AppButton);
    expect(buttons.map((button) => button.props.title)).toEqual(["Keep data", "Reset and continue"]);
    expect(buttons[0].props.variant).toBeUndefined();
    expect(buttons[1].props.variant).toBe("destructive");
  });
  it("requires confirmation before resetting affected data", () => {
    const onReset = jest.fn();
    const { getByTestId, getByText, queryByTestId } = render(
      <RecoveryScreen
        affectedAreas={["Portfolio records"]}
        onReset={onReset}
        recoveryCopiesPreserved
      />,
    );

    expect(getByText("Your original data was preserved")).toBeTruthy();
    expect(getByText("Portfolio records")).toBeTruthy();
    expect(queryByTestId("confirm-storage-reset")).toBeNull();

    fireEvent.press(getByTestId("start-storage-reset"));

    expect(getByTestId("confirm-storage-reset")).toBeTruthy();
    expect(onReset).not.toHaveBeenCalled();

    fireEvent.press(getByTestId("cancel-storage-reset"));

    expect(queryByTestId("confirm-storage-reset")).toBeNull();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("resets only after explicit confirmation", () => {
    const onReset = jest.fn();
    const { getByTestId } = render(
      <RecoveryScreen
        affectedAreas={["Portfolio records", "Current quote cache"]}
        onReset={onReset}
        recoveryCopiesPreserved
      />,
    );

    fireEvent.press(getByTestId("start-storage-reset"));
    fireEvent.press(getByTestId("confirm-storage-reset"));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("does not offer reset when a recovery copy could not be preserved", () => {
    const { getByText, queryByTestId } = render(
      <RecoveryScreen
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
});
