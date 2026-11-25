const { withAndroidManifest } = require("expo/config-plugins");

// Lets other apps share a statement file to CogVest (#771). Only ACTION_SEND
// is registered: a VIEW intent with a content:// URI would reach the router as
// a link. The types are the statements CogVest can import, plus spreadsheets,
// which are recognised and answered with "save it as CSV".
const shareTypes = [
  "text/csv",
  "text/comma-separated-values",
  "text/plain",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

function addShareTarget(manifest) {
  const application = manifest.manifest.application?.[0];
  const activity = application?.activity?.find((item) => item.$["android:name"] === ".MainActivity");
  if (!activity) throw new Error("MainActivity missing; review the share target.");
  const filters = activity["intent-filter"] ?? [];
  const isShare = (filter) => filter.action?.some((action) => action.$["android:name"] === "android.intent.action.SEND");
  activity["intent-filter"] = [
    ...filters.filter((filter) => !isShare(filter)),
    {
      action: [{ $: { "android:name": "android.intent.action.SEND" } }],
      category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
      data: shareTypes.map((type) => ({ $: { "android:mimeType": type } })),
    },
  ];
  return manifest;
}

module.exports = (config) => withAndroidManifest(config, (mod) => {
  mod.modResults = addShareTarget(mod.modResults);
  return mod;
});
module.exports.addShareTarget = addShareTarget;
