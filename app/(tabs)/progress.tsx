import { router } from "expo-router";

import { ProgressScreen } from "@/src/features/progress";

export default function ProgressTabScreen() {
  return <ProgressScreen onReviewSnapshot={() => router.push("/review-snapshot")} />;
}