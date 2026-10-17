import { useIsFocused } from "@react-navigation/native";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";

import { HoldingsScreen as HoldingsFeatureScreen } from "@/src/features/holdings";
import { useQuickSetupSession } from "@/src/features/quickSetup";

export default function HoldingsScreen() {
  const params = useLocalSearchParams<{ statusMessage?: string; openAddMenu?: string; destination?: string }>();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [destinationRequest, setDestinationRequest] = useState<{ destination: "epf" }>();
  const quickSetup = useQuickSetupSession();

  useEffect(() => {
    if (!isFocused || !params.statusMessage) {
      return;
    }

    setStatusMessage(params.statusMessage);
    router.setParams({ statusMessage: undefined });
  }, [isFocused, params.statusMessage]);

  useEffect(() => {
    if (!isFocused || params.destination !== "epf") return;
    setDestinationRequest({ destination: "epf" });
    router.setParams({ destination: undefined });
  }, [isFocused, params.destination]);

  useEffect(
    () =>
      navigation.addListener("blur", () => {
        setStatusMessage(undefined);
      }),
    [navigation],
  );

  return (
    <HoldingsFeatureScreen
      isActive={isFocused}
      destinationRequest={destinationRequest}
      openAddMenu={params.openAddMenu === "true"}
      onAddMenuOpened={() => router.setParams({ openAddMenu: undefined })}
      onOpenDuration={() => router.push("/holding-duration")}
      onOpenFutures={() => router.push("/futures")}
      onAddTrade={() => {
        router.push("/add-holding");
      }}
      onRecordPurchase={(assetId) => {
        router.push({ pathname: "/record-purchase", params: assetId ? { assetId } : {} });
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
      onAddEpfAccount={() => {
        router.push("/epf-account");
      }}
      onReviewEpfAccount={(accountId) => {
        router.push({ pathname: "/epf-account", params: { accountId } });
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
      onImportTransactions={() => {
        router.push("/import-transactions");
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
