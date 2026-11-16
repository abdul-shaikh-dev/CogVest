import type { EpfState } from "@/src/domain/epf/persistence";
import type { UsdmFuturesAccount } from "@/src/domain/usdmFutures";
import type {
  Asset,
  CashEntry,
  Distribution,
  DistributionCoverage,
  MeasurementBasis,
  MonthlySnapshot,
  OpeningPosition,
  PpfAccount,
  PpfLedgerEntry,
  Preferences,
  Trade,
} from "@/src/types";

export const portfolioSchemaVersion = 19;

/** The raw saved portfolio records, shared by the store and backup (#666). */
export type RawPortfolioSnapshot = {
  epf: EpfState;
  assets: Asset[];
  cashEntries: CashEntry[];
  distributionCoverage: DistributionCoverage[];
  distributions: Distribution[];
  futuresAccounts: UsdmFuturesAccount[];
  /** Where whole-portfolio XIRR starts (D9); null until the user sets it. */
  measurementBasis: MeasurementBasis | null;
  monthlySnapshots: MonthlySnapshot[];
  openingPositions: OpeningPosition[];
  ppfAccounts: PpfAccount[];
  ppfLedgerEntries: PpfLedgerEntry[];
  preferences: Preferences;
  schemaVersion: typeof portfolioSchemaVersion;
  trades: Trade[];
};
