import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";

import { HoldingsScreen as HoldingsFeatureScreen } from "@/src/features/holdings";
import { useQuickSetupSession } from "@/src/features/quickSetup";

export default function HoldingsScreen() {
  const params = useLocalSearchParams<{ statusMessage?: string }>();
  const navigation = useNavigation();
  const [statusMessage, setStatusMessage] = useState<string>();
  const quickSetup = useQuickSetupSession();

  useEffect(() => {
    if (!params.statusMessage) {
      return;
    }

    setStatusMessage(params.statusMessage);
    router.setParams({ statusMessage: undefined });
  }, [params.statusMessage]);

  useEffect(
    () =>
      navigation.addListener("blur", () => {
        setStatusMessage(undefined);
      }),
    [navigation],
  );

  return (
    <HoldingsFeatureScreen
      onAddTrade={() => {
        router.push("/add-holding");
      }}
      onAddPpfAccount={(legacy) => {
        router.push({
          pathname: "/ppf-account",
          params: legacy
            ? {
                ...(legacy.assetId ? { legacyAssetId: legacy.assetId } : {}),
                ...(legacy.name ? { legacyName: legacy.name } : {}),
              }
            : {},
        });
      }}
      onReviewAllTrades={() => {
        router.push("/holding-transactions");
      }}
      onManageAssets={() => {
        router.push("/manage-assets");
      }}
      onImportHoldings={() => {
        router.push("/import-holdings");
      }}
      onSellRedeem={(assetId) => {
        router.push({ pathname: "/sell-redeem", params: { assetId } });
      }}
      onQuickSetup={() => {
        router.push("/quick-portfolio-setup");
      }}
      quickSetupSavedCount={quickSetup.session?.items.length ?? 0}
      onReviewOpeningPosition={(openingPositionId) => {
        router.push({
          pathname: "/opening-position",
          params: { openingPositionId },
        });
      }}
      onReviewPpfAccount={(accountId) => {
        router.push({ pathname: "/ppf-account", params: { accountId } });
      }}
      onReviewTrades={(assetId) => {
        router.push({ pathname: "/holding-transactions", params: { assetId } });
      }}
      statusMessage={statusMessage}
    />
  );
}
