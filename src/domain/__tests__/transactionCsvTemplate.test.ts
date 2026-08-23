import { parseTransactionCsv } from "@/src/domain/transactionCsv";
import {
  transactionCsvTemplate,
  transactionCsvTemplateFileName,
} from "@/src/domain/transactionCsvTemplate";

describe("transaction CSV template", () => {
  it("contains representative supported transaction rows", () => {
    const result = parseTransactionCsv(transactionCsvTemplate);

    expect(transactionCsvTemplateFileName).toBe("cogvest-transactions-v1.csv");
    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.transactionType)).toEqual([
      "buy",
      "sell",
      "transferIn",
      "transferOut",
    ]);
    expect(result.rows[2]).toEqual(
      expect.objectContaining({ acquisitionCost: 4500 }),
    );
  });
});
