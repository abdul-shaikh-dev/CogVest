// The EPF persistence and investing-Cash migration QA routes stage "legacy"
// records for the E2E flows. These tests run each route's own staging and
// checks against the real store, so a later schema version cannot leave a
// fixture that storage rejects (as happened when V17 and V18 landed).
import { Alert } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockDatabases = new Map<string, Map<string, string>>();

jest.mock("react-native-mmkv", () => ({
  createMMKV: ({ id }: { id: string }) => {
    const data = mockDatabases.get(id) ?? new Map<string, string>();
    mockDatabases.set(id, data);
    return {
      clearAll: () => data.clear(),
      getString: (key: string) => data.get(key),
      remove: (key: string) => data.delete(key),
      set: (key: string, value: string) => { data.set(key, value); },
    };
  },
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm: string, text: string) =>
    require("crypto").createHash("sha256").update(text).digest("hex"),
}));

let mockParams: { token?: string; page?: string } = {};
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

jest.mock("@/src/testing/visualQaSeed", () => ({
  ...jest.requireActual("@/src/testing/visualQaSeed"),
  canUseVisualQaHarness: () => true,
}));

import EpfPersistenceQaRoute from "@/app/epf-persistence-qa";
import InvestingCashQaRoute from "@/app/investing-cash-qa";

beforeEach(() => {
  mockDatabases.clear();
  mockParams = { token: "cogvest-local-visual-qa" };
});

it("stages a legacy V15 record that the EPF persistence check accepts", async () => {
  render(<EpfPersistenceQaRoute />);

  fireEvent.press(screen.getByTestId("epf-qa-stage"));
  expect(screen.getByText("Legacy staged; restart required")).toBeTruthy();

  fireEvent.press(screen.getByTestId("epf-qa-run"));
  await waitFor(() =>
    expect(screen.getByTestId("epf-qa-status").props.children)
      .toBe("PASS: EPF 135000; Cash 7000; audit 2; corrupt restore blocked"),
  );

  fireEvent.press(screen.getByTestId("epf-qa-check"));
  expect(screen.getByTestId("epf-qa-status").props.children)
    .toBe("PASS: cold restart preserved exact records");
});

it("stages a legacy V14 record that migrates to the exact investing-Cash payload", () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation((_title, _message, buttons) => {
    buttons?.find((button) => button.text === "Stage legacy data")?.onPress?.();
  });
  const first = render(<InvestingCashQaRoute />);

  fireEvent.press(screen.getByTestId("qa-stage-legacy"));
  expect(screen.getByTestId("qa-migration-result").props.children)
    .toBe("Legacy schema 14 staged; cold restart required");
  first.unmount();

  // A fresh mount reads the staged record, as a cold restart does.
  render(<InvestingCashQaRoute />);
  expect(screen.getByTestId("qa-migration-result").props.children)
    .toBe("PASS: full payload preserved; schema 16");
  alert.mockRestore();
});
