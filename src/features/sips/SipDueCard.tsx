import type { StoreApi } from "zustand/vanilla";

import { AppButton, AppText, PremiumCard } from "@/src/components/common";
import { formatDate } from "@/src/domain/formatters";
import type { PortfolioStoreState } from "@/src/store";

import { dueCountText } from "./sipViewModel";
import { useDueSips } from "./useDueSips";

/** Dashboard card (#766): shown only while a SIP instalment waits for the user. */
export function SipDueCard({ now, onOpen, store }: {
  now: Date;
  onOpen?: () => void;
  store: StoreApi<PortfolioStoreState>;
}) {
  const { due } = useDueSips(store, now);
  if (due.length === 0 || !onOpen) return null;
  const names = [...new Set(due.map((item) => item.asset.name))];

  return (
    <PremiumCard section testID="dashboard-sip-due">
      <AppText testID="dashboard-sip-due-count" weight="bold">{dueCountText(due.length)}</AppText>
      <AppText color="secondary" variant="caption">
        {`${names.slice(0, 2).join(", ")}${names.length > 2 ? ` and ${names.length - 2} more` : ""} · oldest due ${formatDate(due[0].dueDate)}`}
      </AppText>
      <AppText color="secondary" variant="caption">Nothing is recorded until you confirm each one.</AppText>
      <AppButton onPress={onOpen} testID="dashboard-sip-due-open" title="Review instalments" variant="ghost" />
    </PremiumCard>
  );
}
