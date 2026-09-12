import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { TransactionImportScreen } from "../TransactionImportScreen";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore } from "@/src/store";
import * as demergers from "@/src/domain/demergers";

afterEach(() => jest.restoreAllMocks());

it("keeps CAS layout failures distinct from unsupported events and prevents saving", async () => {
  jest.spyOn(demergers, "projectDemergers").mockReturnValue([{
    eventId: "RELIANCE-JIOFIN-2023-v1", assetId: "saved-child", sourceAssetId: "saved-parent",
    kind: "entitlement", date: "2023-07-20", quantity: 10, cost: "46.8",
    sourceRecordIds: ["saved-buy"], firstAcquisitionDate: "2023-01-01",
  }]);
  const store = createPortfolioStore({ storage: createMemoryJsonStorage() });
  const before = store.getState();
  const onImported = jest.fn();
  const screen = render(<TransactionImportScreen
    onCancel={jest.fn()}
    onImported={onImported}
    pickCsvFile={jest.fn()}
    pickCasStatement={async () => ({ size: 1024, uri: "content://synthetic.pdf" })}
    readCasStatement={async () => ({
      pageCount: 2,
      normalization: {
        errors: [],
        parserErrors: [{ code: "missingTransactionHeader", message: "A table header could not be read.", rowNumber: 12 }],
        preservedCharges: [], rows: [], schemes: [], unsupportedEvents: [],
      },
    })}
    store={store}
  />);
  fireEvent.press(screen.getByTestId("transaction-import-source-camsKfinCasPdfV1"));
  fireEvent.press(screen.getByTestId("select-cas-statement"));
  await waitFor(() => expect(screen.getByTestId("cas-import-problems")).toBeTruthy());
  expect(screen.queryByText("Skipped unsupported events")).toBeNull();
  expect(screen.queryByTestId("transaction-import-demerger-summary")).toBeNull();
  expect(screen.getByTestId("transaction-import-summary-unsupported")).toHaveTextContent("0");
  expect(screen.getByTestId("confirm-transaction-import")).toHaveAccessibilityState({ disabled: true });
  fireEvent.press(screen.getByTestId("confirm-transaction-import"));
  expect(onImported).not.toHaveBeenCalled();
  expect(store.getState()).toBe(before);
  fireEvent.press(screen.getByTestId("cas-import-problems-toggle"));
  expect(screen.getByText("Extracted row: 12")).toBeTruthy();
});
