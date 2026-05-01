import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { CashScreen } from "@/src/features/cash";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";

describe("CashScreen", () => {
  it("shows an empty cash state with zero balance", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });

    const { getByText } = render(<CashScreen store={store} />);

    expect(getByText("₹0.00")).toBeTruthy();
    expect(getByText("No cash entries yet")).toBeTruthy();
    expect(getByText("Add available broker or bank cash to include it in portfolio value.")).toBeTruthy();
  });

  it("adds and withdraws cash and shows history rows", async () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByLabelText, getByText } = render(<CashScreen store={store} />);

    fireEvent.changeText(getByLabelText("Amount"), "1000");
    fireEvent.changeText(getByLabelText("Label"), "Broker cash");
    fireEvent.changeText(getByLabelText("Date"), "2026-04-20");
    fireEvent.press(getByText("Save Cash Entry"));

    await waitFor(() => {
      expect(getByText("₹1,000.00")).toBeTruthy();
      expect(getByText("Broker cash")).toBeTruthy();
      expect(getByText("+₹1,000.00")).toBeTruthy();
    });

    fireEvent.press(getByText("Withdraw"));
    fireEvent.changeText(getByLabelText("Amount"), "250");
    fireEvent.changeText(getByLabelText("Label"), "Emergency withdrawal");
    fireEvent.changeText(getByLabelText("Date"), "2026-04-21");
    fireEvent.press(getByText("Save Cash Entry"));

    await waitFor(() => {
      expect(getByText("₹750.00")).toBeTruthy();
      expect(getByText("Emergency withdrawal")).toBeTruthy();
      expect(getByText("-₹250.00")).toBeTruthy();
    });
  });

  it("shows validation errors for invalid cash entries", () => {
    const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
    const { getByText } = render(<CashScreen store={store} />);

    fireEvent.press(getByText("Save Cash Entry"));

    expect(getByText("Amount must be a valid number.")).toBeTruthy();
    expect(getByText("Label is required.")).toBeTruthy();
    expect(getByText("Date is required.")).toBeTruthy();
  });
});
