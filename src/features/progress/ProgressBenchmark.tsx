import type { StoreApi } from "zustand/vanilla";

import { PremiumCard, SectionHeader } from "@/src/components/common";
import { BenchmarkComparison, useWholePortfolioXirr } from "@/src/features/dashboard";
import { usePortfolioFields } from "@/src/hooks/usePortfolioSlice";
import type { PortfolioStoreState } from "@/src/store";

/**
 * The Nifty 50 comparison and its chart against stored month-end values
 * (#765). It lives on Progress beside the other month-end charts; the
 * Dashboard keeps a one-line summary. Shown only when the whole-portfolio
 * return has a rate to compare.
 */
export function ProgressBenchmark({ masked, now, store }: {
  masked: boolean;
  now?: Date;
  store: StoreApi<PortfolioStoreState>;
}) {
  const summary = useWholePortfolioXirr(store, now);
  const { monthlySnapshots } = usePortfolioFields(store, ["monthlySnapshots"]);
  if (summary.status !== "rate") return null;
  return (
    <PremiumCard testID="progress-benchmark-card">
      <SectionHeader title="Compared with a Nifty 50 index fund" />
      <BenchmarkComparison masked={masked} monthlySnapshots={monthlySnapshots} summary={summary} />
    </PremiumCard>
  );
}
