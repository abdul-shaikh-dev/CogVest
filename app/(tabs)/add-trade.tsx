import { router } from "expo-router";
import { AppButton, AppText, PremiumCard, ScreenContainer, ScreenHeader } from "@/src/components/common";

export default function AddTradeScreen() {
  // Obsolete parameters may describe a sale, not an opening position.
  // Require an explicit choice instead of forwarding them into another flow.
  return <ScreenContainer scroll testID="legacy-entry-screen">
    <ScreenHeader title="Add or update an investment" />
    <PremiumCard section>
      <AppButton title="Add an existing holding" variant="secondary"
        onPress={() => router.replace("/add-holding")} testID="legacy-existing-holding" />
      <AppButton title="Record a purchase" variant="secondary"
        onPress={() => router.replace("/record-purchase")} testID="legacy-record-purchase" />
      <AppText color="secondary">To sell or redeem, choose a holding first.</AppText>
      <AppButton title="Choose a holding to sell" variant="secondary"
        onPress={() => router.replace("/(tabs)/holdings")} testID="legacy-sell-holding" />
      <AppButton title="Cancel" variant="ghost"
        onPress={() => router.replace("/(tabs)/holdings")} testID="legacy-cancel" />
    </PremiumCard>
  </ScreenContainer>;
}
