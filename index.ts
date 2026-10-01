import "react-native-gesture-handler";
// Opt-in local QA APK only; ordinary preview/production builds do not start it.
if (process.env.EXPO_PUBLIC_COGVEST_PERFORMANCE_PROBE === "1") {
  require("./src/testing/performanceProbe").startPerformanceProbe();
}
import "expo-router/entry";
