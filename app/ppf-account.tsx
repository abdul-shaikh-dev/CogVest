import { router, useLocalSearchParams } from "expo-router";

import { PpfAccountScreen } from "@/src/features/ppf";
import { getQuickSetupSessionStore } from "@/src/features/quickSetup";
import { getPortfolioStore } from "@/src/store";

export default function PpfAccountRoute() {
  const params = useLocalSearchParams<{
    accountId?: string;
    legacyAssetId?: string;
    legacyName?: string;
    returnTo?: "quick-portfolio-setup";
  }>();

  return (
    <PpfAccountScreen
      key={params.accountId ?? "new"}
      accountId={params.accountId}
      legacyAssetId={params.legacyAssetId}
      legacyName={params.legacyName}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/holdings");
      }}
      onComplete={(accountId) => {
        if (
          params.returnTo === "quick-portfolio-setup" &&
          !params.accountId
        ) {
          const account = getPortfolioStore()
            .getState()
            .ppfAccounts.find((candidate) => candidate.id === accountId);

          if (account) {
            getQuickSetupSessionStore().getState().recordItem({
              kind: "ppfAccount",
              name: account.nickname,
              recordId: account.id,
            });
          }

          router.replace({
            pathname: "/ppf-account",
            params: { accountId, returnTo: "quick-portfolio-setup" },
          });
          return;
        }

        router.replace({
          pathname: "/ppf-account",
          params: {
            accountId,
            ...(params.returnTo ? { returnTo: params.returnTo } : {}),
          },
        });
      }}
      onContinuePortfolioSetup={
        params.returnTo === "quick-portfolio-setup"
          ? () => {
              router.dismissTo("/quick-portfolio-setup");
            }
          : undefined
      }
      onEntry={(accountId, entryId) =>
        router.push({
          pathname: "/ppf-entry",
          params: { accountId, ...(entryId ? { entryId } : {}) },
        })
      }
      onImport={(accountId) => router.push({ pathname: "/import-ppf", params: { accountId } })}
    />
  );
}
