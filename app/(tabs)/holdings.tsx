import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";

import { HoldingsScreen as HoldingsFeatureScreen } from "@/src/features/holdings";

export default function HoldingsScreen() {
  const params = useLocalSearchParams<{ statusMessage?: string }>();
  const navigation = useNavigation();
  const [statusMessage, setStatusMessage] = useState<string>();

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
      onSellRedeem={(assetId) => {
        router.push({ pathname: "/sell-redeem", params: { assetId } });
      }}
      onReviewOpeningPosition={(openingPositionId) => {
        router.push({
          pathname: "/opening-position",
          params: { openingPositionId },
        });
      }}
      statusMessage={statusMessage}
    />
  );
}
