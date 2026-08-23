import {
  parseTransactionCsv,
  type TransactionCsvParseResult,
} from "./transactionCsv";
import { parseZerodhaTradebook } from "./zerodhaTradebook";

export const transactionImportSourceIds = [
  "cogvestCsvV1",
  "zerodhaTradebookEqV1",
] as const;

export type TransactionImportSourceId =
  (typeof transactionImportSourceIds)[number];

export type TransactionImportSourceDefinition = {
  description: string;
  id: TransactionImportSourceId;
  label: string;
  multipleFiles: boolean;
};

export const transactionImportSources: TransactionImportSourceDefinition[] = [
  {
    description: "CogVest's versioned broker-neutral transaction template.",
    id: "cogvestCsvV1",
    label: "CogVest CSV",
    multipleFiles: false,
  },
  {
    description: "Delivery-equity Tradebook files exported from Zerodha Console.",
    id: "zerodhaTradebookEqV1",
    label: "Zerodha Tradebook",
    multipleFiles: true,
  },
];

export function parseTransactionImportFile(input: {
  fileIndex: number;
  fileName: string;
  sourceId: TransactionImportSourceId;
  text: string;
}): TransactionCsvParseResult {
  const parsed =
    input.sourceId === "zerodhaTradebookEqV1"
      ? parseZerodhaTradebook(input.text, {
          fileIndex: input.fileIndex,
          fileName: input.fileName,
        })
      : parseTransactionCsv(input.text);

  return {
    ...parsed,
    rows: parsed.rows.map((row) => ({
      ...row,
      source: {
        ...(input.sourceId === "cogvestCsvV1"
          ? { format: "cogvest-transactions", version: "1" }
          : { format: "zerodha-tradebook", version: "eq-v1" }),
        ...row.source,
        fileIndex: input.fileIndex,
        fileName: input.fileName,
      },
    })),
  };
}
