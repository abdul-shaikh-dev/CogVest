import { router } from "expo-router";

import { SipDueScreen } from "@/src/features/sips";

export default function SipDueRoute() {
  return (
    <SipDueScreen
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/(tabs)/dashboard");
      }}
      onConfirm={(templateId, month) => router.push({ pathname: "/sip-confirm", params: { month, templateId } })}
    />
  );
}
