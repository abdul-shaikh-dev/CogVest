import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import type { SharedFile } from "@/modules/cogvest-share-intent";
import type { ImportFileKind } from "@/src/domain/importFileDetection";
import { probeImportFile, type ImportFileRef } from "@/src/services/import-export/importFileProbe";
import {
  peekPendingImportFile,
  setPendingImportFile,
  takePendingImportFile,
  withPendingFile,
} from "@/src/services/import-export/pendingImportFile";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { createPortfolioStore, type PortfolioStoreState } from "@/src/store";

import { ImportFileScreen } from "../ImportFileScreen";
import { routeForImportFile } from "../importFileViewModel";
import { SharedFileReceiver } from "../SharedFileReceiver";

const mockNavigation = { pathname: "/(tabs)/dashboard", rootKey: "root" as string | undefined };
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  usePathname: () => mockNavigation.pathname,
  useRootNavigationState: () => (mockNavigation.rootKey ? { key: mockNavigation.rootKey } : undefined),
}));

const csv: ImportFileRef = { mimeType: "text/csv", name: "tradebook.csv", size: 120, uri: "content://files/tradebook.csv" };
const account = (id: string, nickname: string) => ({ id, nickname });

function store(ppfAccounts: { id: string; nickname: string }[] = []) {
  const result = createPortfolioStore({ storage: createMemoryJsonStorage() });
  result.setState({ ppfAccounts } as unknown as Partial<PortfolioStoreState>);
  return result;
}

afterEach(() => {
  setPendingImportFile(null);
  mockNavigation.pathname = "/(tabs)/dashboard";
  mockNavigation.rootKey = "root";
});

describe("import file routing (#771)", () => {
  it.each<[ImportFileKind, string, Record<string, string>]>([
    ["holdingsCsv", "/import-holdings", { file: "1" }],
    ["transactionsCsv", "/import-transactions", { file: "1", source: "cogvestCsvV1" }],
    ["zerodhaTradebook", "/import-transactions", { file: "1", source: "zerodhaTradebookEqV1" }],
    ["casPdf", "/import-transactions", { file: "1", source: "camsKfinCasPdfV1" }],
  ])("opens the %s review", (kind, pathname, params) => {
    expect(routeForImportFile(kind, [])).toEqual({ kind: "open", params, pathname });
  });

  it("sends a PPF statement to the only account, asks among several, and explains when there is none", () => {
    expect(routeForImportFile("ppfCsv", [account("ppf-1", "Main PPF")])).toEqual({
      kind: "open", params: { accountId: "ppf-1", file: "1" }, pathname: "/import-ppf",
    });
    expect(routeForImportFile("ppfCsv", [account("a", "Mine"), account("b", "Spouse")])).toMatchObject({ kind: "choosePpfAccount" });
    expect(routeForImportFile("ppfCsv", [])).toMatchObject({ kind: "message", message: expect.stringContaining("Add the PPF account") });
  });

  it("asks about a readable PDF and explains spreadsheets and unknown files", () => {
    expect(routeForImportFile("pdf", [])).toEqual({ kind: "choosePdf" });
    expect(routeForImportFile("spreadsheet", [])).toMatchObject({ message: expect.stringContaining("save it as CSV") });
    expect(routeForImportFile("unknown", [])).toMatchObject({ message: expect.stringContaining("nothing was imported") });
  });
});

describe("import file probe (#771)", () => {
  function handle(bytes: string) {
    const data = Uint8Array.from(bytes, (character) => character.charCodeAt(0));
    const reads: { length: number; offset: number }[] = [];
    const value = {
      close: jest.fn(),
      offset: 0 as number | null,
      readBytes(length: number) {
        const offset = value.offset ?? 0;
        reads.push({ length, offset });
        value.offset = offset + length;
        return data.subarray(offset, offset + length);
      },
      size: data.length as number | null,
    };
    return { reads, value };
  }

  it("reads only the head of a CSV and closes the file", async () => {
    const file = handle("symbol,isin,trade_date,exchange,segment,series,trade_type,auction,quantity,price,trade_id,order_id\n" + "x".repeat(9000));
    await expect(probeImportFile(csv, { open: () => file.value })).resolves.toBe("zerodhaTradebook");
    expect(file.reads).toEqual([{ length: 4096, offset: 0 }]);
    expect(file.value.close).toHaveBeenCalled();
  });

  it("reads a PDF's trailer for encryption", async () => {
    const encrypted = handle(`%PDF-1.7\n${"0".repeat(10000)}\ntrailer << /Encrypt 5 0 R >>`);
    const plain = handle(`%PDF-1.7\n${"0".repeat(10000)}\ntrailer << /Root 1 0 R >>`);
    const pdf = { name: "statement.pdf", uri: "content://pdf" };
    await expect(probeImportFile(pdf, { open: () => encrypted.value })).resolves.toBe("casPdf");
    expect(encrypted.reads[1].offset).toBe(encrypted.value.size! - 4096);
    await expect(probeImportFile(pdf, { open: () => plain.value })).resolves.toBe("pdf");
  });

  it("treats an empty file as unknown and still closes it", async () => {
    const empty = handle("");
    await expect(probeImportFile(csv, { open: () => ({ ...empty.value, size: 0 }) })).resolves.toBe("unknown");
  });
});

describe("pending import file (#771)", () => {
  it("hands the pending file to one reader, then falls back to the picker", async () => {
    const read = jest.fn(async (file: ImportFileRef) => file.name);
    const pick = jest.fn(async () => "picked");
    const picker = withPendingFile(read, pick);
    setPendingImportFile(csv);

    await expect(picker()).resolves.toBe("tradebook.csv");
    await expect(picker()).resolves.toBe("picked");
    expect(read).toHaveBeenCalledTimes(1);
    expect(peekPendingImportFile()).toBeNull();
  });
});

describe("ImportFileScreen (#771)", () => {
  async function screen(kind: ImportFileKind, options: { ppf?: { id: string; nickname: string }[]; shared?: ImportFileRef } = {}) {
    const onOpen = jest.fn();
    const pickFile = jest.fn(async () => csv);
    const probeFile = jest.fn(async () => kind);
    const view = await render(<ImportFileScreen
      onBack={jest.fn()}
      onOpen={onOpen}
      pickFile={pickFile}
      probeFile={probeFile}
      store={store(options.ppf)}
      takeSharedFile={() => options.shared ?? null}
    />);
    return { onOpen, pickFile, probeFile, view };
  }

  it("opens the detected review for a chosen file", async () => {
    const { onOpen, view } = await screen("zerodhaTradebook");
    await fireEvent.press(view.getByTestId("import-file-choose"));
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(csv, {
      params: { file: "1", source: "zerodhaTradebookEqV1" }, pathname: "/import-transactions",
    }));
  });

  it("reads a shared file on arrival without the picker", async () => {
    const shared = { ...csv, name: "holdings.csv" };
    const { onOpen, pickFile } = await screen("holdingsCsv", { shared });
    await waitFor(() => expect(onOpen).toHaveBeenCalledWith(shared, { params: { file: "1" }, pathname: "/import-holdings" }));
    expect(pickFile).not.toHaveBeenCalled();
  });

  it("asks which statement a readable PDF is", async () => {
    const pdf = { mimeType: "application/pdf", name: "passbook.pdf", size: 900, uri: "content://passbook" };
    const { onOpen, view } = await screen("pdf", { shared: pdf });
    await fireEvent.press(await view.findByTestId("import-file-pdf-epf"));
    expect(onOpen).toHaveBeenCalledWith(pdf, { params: { file: "1" }, pathname: "/epf-import" });
  });

  it("asks which PPF account a statement is for", async () => {
    const { onOpen, view } = await screen("ppfCsv", { ppf: [account("a", "Mine"), account("b", "Spouse")], shared: csv });
    await fireEvent.press(await view.findByText("Spouse"));
    expect(onOpen).toHaveBeenCalledWith(csv, { params: { accountId: "b", file: "1" }, pathname: "/import-ppf" });
  });

  it("explains an unsupported file and opens nothing", async () => {
    const { onOpen, view } = await screen("unknown", { shared: csv });
    expect(await view.findByTestId("import-file-message")).toHaveTextContent(/nothing was imported/u);
    expect(view.getByTestId("import-file-kind")).toHaveTextContent("Unrecognised file");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("reports a file that can't be opened", async () => {
    const onOpen = jest.fn();
    const view = await render(<ImportFileScreen
      onBack={jest.fn()}
      onOpen={onOpen}
      pickFile={async () => csv}
      probeFile={async () => { throw new Error("permission revoked"); }}
      store={store()}
      takeSharedFile={() => null}
    />);
    await fireEvent.press(view.getByTestId("import-file-choose"));
    expect(await view.findByTestId("import-file-error")).toHaveTextContent(/nothing was imported/u);
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("SharedFileReceiver (#771)", () => {
  it("waits for the launch redirect, then opens a shared file once", async () => {
    mockNavigation.pathname = "/";
    const files: SharedFile[] = [{ ...csv, mimeType: "text/csv", size: 120 }];
    const take = jest.fn(() => files.shift() ?? null);
    const navigate = jest.fn();
    const remove = jest.fn();
    let notify = () => {};
    const addListener = (listener: () => void) => { notify = listener; return { remove }; };

    const view = await render(<SharedFileReceiver addListener={addListener} navigate={navigate} take={take} />);
    expect(take).not.toHaveBeenCalled();

    mockNavigation.pathname = "/(tabs)/dashboard";
    await view.rerender(<SharedFileReceiver addListener={addListener} navigate={navigate} take={take} />);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(takePendingImportFile()).toEqual(csv);

    // A share while running is taken once; a stale notification opens nothing.
    files.push({ ...csv, mimeType: "text/csv", name: "second.csv", size: 120 });
    await act(() => notify());
    expect(navigate).toHaveBeenCalledTimes(2);
    expect(peekPendingImportFile()?.name).toBe("second.csv");
    await act(() => notify());
    expect(navigate).toHaveBeenCalledTimes(2);

    await view.unmount();
    expect(remove).toHaveBeenCalled();
  });
});
