import { fireEvent, render } from "@testing-library/react-native";

import { CasImportProblems } from "../CasImportProblems";

describe("CAS import problems", () => {
  it("does not render an empty problem panel", () => {
    const screen = render(<CasImportProblems problems={[]} />);
    expect(screen.queryByTestId("cas-import-problems")).toBeNull();
  });

  it("groups repeated diagnostics behind an actionable summary without losing rows", () => {
    const screen = render(<CasImportProblems problems={[
      { message: "A table header could not be read.", rowNumber: 12 },
      { message: "A table header could not be read.", rowNumber: 40 },
      { message: "Balances do not reconcile.", rowNumber: 52 },
    ]} />);
    expect(screen.getByText(/Nothing has been imported/)).toBeTruthy();
    expect(screen.queryByTestId("cas-import-problems-details")).toBeNull();
    fireEvent.press(screen.getByText("Show 3 issues"));
    expect(screen.getByText("A table header could not be read. (2 occurrences)")).toBeTruthy();
    expect(screen.getByText("Extracted rows: 12, 40")).toBeTruthy();
    expect(screen.getByText("Extracted row: 52")).toBeTruthy();
    fireEvent.press(screen.getByText("Hide details"));
    expect(screen.queryByTestId("cas-import-problems-details")).toBeNull();
  });
});
