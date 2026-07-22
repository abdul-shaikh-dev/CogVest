import { fireEvent, render } from "@testing-library/react-native";

import { RecoveryScreen } from "../RecoveryScreen";

describe("RecoveryScreen", () => {
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
