import { useEffect, useState } from "react";
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
 *
 * The return and the comparison take real work for a long history, so the
 * card mounts after the tab switch has finished; the tap never waits for it.
 */
export function ProgressBenchmark(props: Props) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setReady(true), { timeout: 500 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);
  return ready ? <ProgressBenchmarkCard {...props} /> : null;
}

type Props = {
  masked: boolean;
  now?: Date;
  store: StoreApi<PortfolioStoreState>;
};

function ProgressBenchmarkCard({ masked, now, store }: Props) {
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
