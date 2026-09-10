import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { AppButton, AppText, ScreenContainer } from "@/src/components/common";
import { AssetHistoryPanel, assetHistoryRange } from "@/src/features/holdings/AssetHistoryPanel";
import { createDailyPriceCache } from "@/src/services/quotes/dailyPriceCache";
import { createMemoryJsonStorage } from "@/src/services/storage";
import { canUseVisualQaHarness } from "@/src/testing/visualQaSeed";
import type { Asset, BuyTrade } from "@/src/types";

const asset: Asset = { id: "history-qa", name: "History QA", symbol: "QA", ticker: "HISTORY-QA.NS", currency: "INR", assetClass: "stock" };

function EnabledHistoryQa() {
  const started = useRef(performance.now());
  const reported = useRef(false);
  const [masked, setMasked] = useState(false);
  const [fixture] = useState(() => {
    const { from, to } = assetHistoryRange(120);
    const count = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
    const cache = createDailyPriceCache({ storage: createMemoryJsonStorage() });
    const written = cache.write({ basis: "close", provider: "yahoo", providerId: asset.ticker, currency: "INR", from, to, complete: true, fetchedAt: new Date().toISOString(), points: Array.from({ length: count }, (_, i) => ({ date: new Date(Date.parse(from) + i * 86400000).toISOString().slice(0, 10), close: 100 + 100 * i / (count - 1) })) });
    if (written.status !== "stored") throw new Error("Synthetic cache could not be populated");
    const trade: BuyTrade = { id: "qa-buy", assetId: asset.id, type: "buy", date: assetHistoryRange(24).from, quantity: 3, pricePerUnit: 150, totalValue: 450 };
    return { cache, opening: { id: "qa-opening", assetId: asset.id, date: from, quantity: 2, averageCostPrice: 100 }, trade };
  });
  return <ScreenContainer scroll testID="asset-history-qa-screen">
    <AppText weight="bold">Synthetic history QA</AppText>
    <AppText color="secondary">In-memory fixture only. Saved portfolio data is unchanged.</AppText>
    <AppButton title={masked ? "Show values" : "Hide values"} testID="history-qa-mask" onPress={() => setMasked(!masked)} variant="secondary" />
    <AssetHistoryPanel asset={asset} openingPositions={[fixture.opening]} trades={[fixture.trade]} masked={masked} minimal={false} historyCache={fixture.cache} onChartLayout={() => {
      if (!reported.current) {
        reported.current = true;
        console.info("[asset-history-qa] readyMs", performance.now() - started.current);
      }
    }} />
  </ScreenContainer>;
}

export default function AssetHistoryQaRoute() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  if (!canUseVisualQaHarness({ isDevelopment: __DEV__, token })) return <AppText testID="asset-history-qa-blocked">History QA is unavailable.</AppText>;
  return <EnabledHistoryQa />;
}
