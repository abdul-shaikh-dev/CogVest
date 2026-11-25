import { router, useLocalSearchParams } from "expo-router";

import { SipConfirmScreen } from "@/src/features/sips";

export default function SipConfirmRoute() {
  const params = useLocalSearchParams<{ month?: string; templateId?: string }>();
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/sip-due");
  };

  return (
    <SipConfirmScreen
      key={`${params.templateId ?? ""}-${params.month ?? ""}`}
      month={params.month ?? ""}
      onBack={leave}
      onDone={leave}
      templateId={params.templateId ?? ""}
    />
  );
}
