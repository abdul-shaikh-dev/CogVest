import { router } from "expo-router";

import { CashScreen as CashFeatureScreen } from "@/src/features/cash";

export default function CashScreen() {
  return (
    <CashFeatureScreen
      onCorrectEntry={(entryId) => {
        router.push({ pathname: "/cash-entry", params: { entryId } });
      }}
    />
  );
}
