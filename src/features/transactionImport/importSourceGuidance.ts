import type { TransactionImportSourceId } from "@/src/domain/transactionImportSources";

export type ImportSourceGuidance = {
  browserFallback: string;
  fileLabel: string;
  officialUrl: string;
  steps: string[];
  verifiedOn: string;
};

export const importSourceGuidance: Partial<
  Record<TransactionImportSourceId, ImportSourceGuidance>
> = {
  camsKfinCasPdfV1: {
    browserFallback: "camsonline.com > Statements > CAS - CAMS + KFintech",
    fileLabel: "detailed CAS PDF",
    officialUrl:
      "https://www.camsonline.com/InvestorServices/COL_ISMailBackServices.aspx",
    steps: [
      "Request CAS - CAMS + KFintech and choose Detailed, not Summary.",
      "For a complete rebuild, choose a period beginning before your first mutual-fund investment.",
      "Create the PDF password on the provider website. Enter it only when CogVest reads the downloaded PDF.",
    ],
    verifiedOn: "2026-09-14",
  },
  zerodhaTradebookEqV1: {
    browserFallback: "support.zerodha.com and search for download Tradebook",
    fileLabel: "Tradebook CSV",
    officialUrl:
      "https://support.zerodha.com/category/console/reports/other-queries/articles/where-can-i-see-all-the-trades-i-ve-taken-for-a-particular-period",
    steps: [
      "In Zerodha Console, open Reports, then Tradebook, and select the Equity segment.",
      "Choose a date range of no more than 365 days and download CSV, not a holdings or contract-note report.",
      "Add each annual file needed for your history. Tradebooks may omit external transfers and some corporate actions.",
    ],
    verifiedOn: "2026-09-14",
  },
};
