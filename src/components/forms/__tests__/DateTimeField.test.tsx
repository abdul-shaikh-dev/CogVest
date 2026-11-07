import { fireEvent, render } from "@testing-library/react-native";
import { DateTimeField } from "../DateTimeField";

jest.mock("@react-native-community/datetimepicker", () => (props: Record<string, unknown>) => require("react").createElement("DateTimePicker", props));

describe("DateTimeField", () => {
  const at = "2026-09-01T10:20:58.123+05:30";
  it("does not fabricate evidence and copies a time only on explicit confirmation", async () => {
    const onChange = jest.fn();
    const ui = await render(<DateTimeField label="Rate observed at" value="" onChange={onChange} suggestedAt={at} testID="time" />);
    expect(onChange).not.toHaveBeenCalled();
    expect(ui.getByText(/Device time · UTC/)).toBeTruthy();
    await fireEvent.press(ui.getByTestId("time-use-time"));
    expect(onChange).toHaveBeenCalledWith(at);
  });
  it("retains exact values on display, hides technical entry and preserves picker precision", async () => {
    const onChange = jest.fn();
    const ui = await render(<DateTimeField label="Activity time" value={at} onChange={onChange} testID="time" />);
    expect(ui.queryByTestId("time")).toBeNull();
    expect(ui.getByTestId("time-exact-toggle")).toBeCollapsed();
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByTestId("time-date"));
    await fireEvent(ui.getByTestId("time-picker"), "onChange", { type: "dismissed" });
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(ui.getByTestId("time-time"));
    await fireEvent(ui.getByTestId("time-picker"), "onChange", { type: "set" }, new Date(2026, 8, 1, 9, 45));
    const result = new Date(onChange.mock.calls[0][0]);
    expect([result.getHours(), result.getMinutes(), result.getSeconds(), result.getMilliseconds()]).toEqual([9, 45, 58, 123]);
    await fireEvent.press(ui.getByTestId("time-exact-toggle"));
    expect(ui.getByTestId("time-exact-toggle")).toBeExpanded();
    expect(ui.getByTestId("time").props.value).toBe(at);
    await fireEvent.press(ui.getByTestId("time-exact-toggle"));
    expect(ui.queryByTestId("time")).toBeNull();
    await fireEvent.press(ui.getByTestId("time-exact-toggle"));
    expect(ui.getByTestId("time").props.value).toBe(at);
  });
});
