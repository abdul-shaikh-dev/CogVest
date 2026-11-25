const { addShareTarget } = require("../../plugins/withShareTarget");

type Filter = { action?: { $: Record<string, string> }[]; data?: { $: Record<string, string> }[] };

function manifest() {
  return {
    manifest: {
      application: [{
        activity: [{
          $: { "android:name": ".MainActivity", "android:launchMode": "singleTask" },
          "intent-filter": [
            { action: [{ $: { "android:name": "android.intent.action.MAIN" } }] },
            { action: [{ $: { "android:name": "android.intent.action.VIEW" } }], data: [{ $: { "android:scheme": "cogvest" } }] },
          ],
        }],
      }],
    },
  };
}

function filters(result: ReturnType<typeof manifest>): Filter[] {
  return result.manifest.application[0].activity[0]["intent-filter"];
}

describe("share target plugin (#771)", () => {
  it("is registered with the app config", () => {
    expect(require("../../app.json").expo.plugins).toContain("./plugins/withShareTarget");
  });

  it("adds one SEND filter for the importable types and keeps the existing filters", () => {
    const result = filters(addShareTarget(manifest()));
    const share = result.filter((filter) => filter.action?.[0].$["android:name"] === "android.intent.action.SEND");

    expect(result).toHaveLength(3);
    expect(share).toHaveLength(1);
    expect(share[0].data?.map((item) => item.$["android:mimeType"])).toEqual(expect.arrayContaining(["text/csv", "application/pdf"]));
    // No VIEW filter for files: those would reach the router as links.
    expect(result.filter((filter) => filter.data?.some((item) => item.$["android:mimeType"]) && filter !== share[0])).toHaveLength(0);
  });

  it("is idempotent", () => {
    expect(filters(addShareTarget(addShareTarget(manifest())))).toHaveLength(3);
  });

  it("fails loudly when MainActivity is missing", () => {
    expect(() => addShareTarget({ manifest: { application: [{ activity: [] }] } })).toThrow("MainActivity missing");
  });
});
