import { render } from "@testing-library/react-native";

import { DatePickerField, FormTextField, MoneyField, SelectionField } from "@/src/components/forms";

describe("form field accessibility (#669)", () => {
  it("shows and speaks the money field's currency", async () => {
    const inr = await render(<MoneyField currency="INR" label="Amount" onChangeText={jest.fn()} testID="amount" value="" />);
    expect(inr.getByTestId("amount-prefix")).toHaveTextContent("₹");
    expect(inr.getByLabelText("Amount, in rupees").props.keyboardType).toBe("decimal-pad");

    const usd = await render(<MoneyField currency="USD" label="Price" onChangeText={jest.fn()} testID="price" value="" />);
    expect(usd.getByTestId("price-prefix")).toHaveTextContent("$");
    expect(usd.getByLabelText("Price, in US dollars")).toBeTruthy();
  });

  it("ties an error to its field and announces it politely", async () => {
    const view = await render(
      <FormTextField error="Enter an amount." label="Amount" onChangeText={jest.fn()} testID="amount" value="" />,
    );
    expect(view.getByLabelText("Amount, Error: Enter an amount.")).toBeTruthy();
    expect(view.getByTestId("amount-error").props.accessibilityLiveRegion).toBe("polite");
  });

  it("announces the chosen date with the date field", async () => {
    const view = await render(
      <DatePickerField label="Date" onChange={jest.fn()} testID="date" value="2026-03-05" />,
    );
    expect(view.getByTestId("date").props.accessibilityLabel).toBe("Choose Date, 5 Mar 2026");
  });

  it("gives a selection field its selected value", async () => {
    const view = await render(
      <SelectionField
        label="Managed by"
        onChange={jest.fn()}
        options={[{ label: "EPFO", value: "epfo" }]}
        testIDPrefix="provider"
        value="epfo"
      />,
    );
    expect(view.getByTestId("provider-picker").props.accessibilityValue).toEqual({ text: "EPFO" });
  });
});
