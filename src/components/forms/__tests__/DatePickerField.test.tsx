import { fireEvent, render } from "@testing-library/react-native";

import { DatePickerField } from "@/src/components/forms";

describe("DatePickerField", () => {
  const maximumDate = new Date(2026, 6, 22, 12);

  it("opens accessibly and confirms a canonical local date", () => {
    const onChange = jest.fn();
    const { getByLabelText, getByTestId, queryByTestId } = render(
      <DatePickerField
        label="Date acquired"
        maximumDate={maximumDate}
        onChange={onChange}
        testID="date-field"
        value="2026-07-20"
      />,
    );

    expect(getByLabelText("Choose Date acquired")).toBeTruthy();
    expect(queryByTestId("date-field-picker")).toBeNull();

    fireEvent.press(getByTestId("date-field"));
    fireEvent(
      getByTestId("date-field-picker"),
      "onChange",
      { nativeEvent: { timestamp: new Date(2026, 6, 21, 12).getTime() } },
    );

    expect(onChange).toHaveBeenCalledWith("2026-07-21");
    expect(queryByTestId("date-field-picker")).toBeNull();
  });

  it("closes without changing the value when cancelled", () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <DatePickerField
        label="Date"
        maximumDate={maximumDate}
        onChange={onChange}
        testID="date-field"
        value="2026-07-20"
      />,
    );

    fireEvent.press(getByTestId("date-field"));
    fireEvent(getByTestId("date-field-picker"), "onPickerDismiss");

    expect(onChange).not.toHaveBeenCalled();
    expect(queryByTestId("date-field-picker")).toBeNull();
  });
});
