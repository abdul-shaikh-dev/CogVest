import { useMemo } from "react";
import type { StoreApi } from "zustand/vanilla";

import { formatLocalCalendarDate } from "@/src/domain/dates";
import { dueSipInstalments } from "@/src/domain/sipTemplates";
import { usePortfolioFields } from "@/src/hooks";
import type { PortfolioStoreState } from "@/src/store";

/** Due SIP instalments (#766) with their template and holding, oldest first. */
export function useDueSips(store: StoreApi<PortfolioStoreState>, now: Date) {
  const { assets, preferences, sipTemplates, trades } = usePortfolioFields(store, ["assets", "preferences", "sipTemplates", "trades"]);
  const today = formatLocalCalendarDate(now);
  const due = useMemo(() => {
    const tradeIds = new Set(trades.map((trade) => trade.id));
    const templates = new Map(sipTemplates.map((template) => [template.id, template]));
    const holdings = new Map(assets.map((asset) => [asset.id, asset]));
    return dueSipInstalments(sipTemplates, today, tradeIds).flatMap((item) => {
      const template = templates.get(item.templateId);
      const asset = template ? holdings.get(template.assetId) : undefined;
      return template && asset ? [{ ...item, asset, template }] : [];
    });
  }, [assets, sipTemplates, today, trades]);
  return { due, masked: preferences.maskWealthValues };
}
