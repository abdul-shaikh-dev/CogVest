import { readFileSync } from "node:fs";
import { join } from "node:path";

import { detectImportFile, pdfDeclaresEncryption } from "@/src/domain/importFileDetection";

const fixtures = join(__dirname, "../../../e2e/fixtures");
function head(file: string, bytes = 4096) {
  return readFileSync(join(fixtures, file)).subarray(0, bytes).toString("latin1");
}
function tail(file: string) {
  const buffer = readFileSync(join(fixtures, file));
  return buffer.subarray(Math.max(0, buffer.length - 4096)).toString("latin1");
}

describe("import file detection (#771)", () => {
  it.each([
    ["holdings-import-v1.csv", "holdingsCsv"],
    ["transactions-import-v1.csv", "transactionsCsv"],
    ["zerodha-tradebook-2025.csv", "zerodhaTradebook"],
    ["ppf-import.csv", "ppfCsv"],
    ["ppf-merge.csv", "ppfCsv"],
  ])("recognises %s", (file, kind) => {
    expect(detectImportFile({ head: head(file), mimeType: "text/csv", name: file })).toBe(kind);
  });

  it("tells an encrypted CAS PDF from a readable PDF that needs a choice", () => {
    const cas = "cas-native-synthetic.pdf";
    const epf = "epf-passbook-new-2022.pdf";
    expect(detectImportFile({ head: head(cas), name: cas, pdfEncrypted: pdfDeclaresEncryption(tail(cas)) })).toBe("casPdf");
    expect(detectImportFile({ head: head(epf), name: epf, pdfEncrypted: pdfDeclaresEncryption(tail(epf)) })).toBe("pdf");
  });

  it("ignores a BOM, quotes, case and blank leading lines", () => {
    const text = "﻿\n\"Symbol\",\"ISIN\",\"Trade_Date\",Exchange,Segment,Series,Trade_Type,Auction,Quantity,Price,Trade_ID,Order_ID,Order_Execution_Time\n";
    expect(detectImportFile({ head: text, name: "tradebook.csv" })).toBe("zerodhaTradebook");
    expect(detectImportFile({ head: "ï»¿date,type,amount\n", name: "ppf.csv" })).toBe("ppfCsv");
  });

  it("does not take lookalike headers for a supported format", () => {
    expect(detectImportFile({ head: "symbol,isin,trade_date,quantity,price\n", name: "partial.csv" })).toBe("unknown");
    expect(detectImportFile({ head: "date,type,amount,category\n", name: "bank.csv" })).toBe("unknown");
    expect(detectImportFile({ head: "name,quantity,average_cost\n", name: "holdings.csv" })).toBe("unknown");
    expect(detectImportFile({ head: "Date,Narration,Debit,Credit\n", name: "statement.csv" })).toBe("unknown");
  });

  it("treats damaged, empty and binary files as unknown, whatever the name says", () => {
    expect(detectImportFile({ head: "", name: "empty.csv" })).toBe("unknown");
    expect(detectImportFile({ head: "cogvest_version\u0000\u0001\u0002", name: "broken.csv" })).toBe("unknown");
    expect(detectImportFile({ head: "not a pdf at all", name: "statement.pdf", mimeType: "application/pdf" })).toBe("unknown");
  });

  it("recognises spreadsheets by type, name or container bytes", () => {
    expect(detectImportFile({ head: "PK\u0003\u0004rest", name: "tradebook.xlsx" })).toBe("spreadsheet");
    expect(detectImportFile({ head: "ÐÏ\u0011à", name: "old" })).toBe("spreadsheet");
    expect(detectImportFile({ head: "x", mimeType: "application/vnd.ms-excel", name: "book" })).toBe("spreadsheet");
  });
});
