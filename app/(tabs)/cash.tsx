import { useIsFocused } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";

import { CashScreen as CashFeatureScreen } from "@/src/features/cash";

export default function CashScreen() {
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{
    openIncomeEntry?: string;
    returnTo?: "dashboard";
  }>();

  return (
    <CashFeatureScreen
      openIncomeEntry={isFocused && params.openIncomeEntry === "true"}
      onIncomeEntryClosed={() => {
        if (params.returnTo === "dashboard") {
          router.setParams({ returnTo: undefined });
        }
      }}
      onIncomeEntryOpened={() => router.setParams({ openIncomeEntry: undefined })}
      onIncomeRecorded={() => {
        if (params.returnTo === "dashboard") {
          router.setParams({ returnTo: undefined });
          router.navigate("/(tabs)/dashboard");
        }
      }}
      onCorrectEntry={(entryId) => {
        router.push({ pathname: "/cash-entry", params: { entryId } });
      }}
    />
  );
}
