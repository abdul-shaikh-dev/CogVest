const { patchBoundedDocumentRead } = require("../../plugins/withBoundedDocumentRead");

const original = `uri.isSAFUri -> context.contentResolver.openInputStream(uri)!!
val bytesRead = inputStream.read(buffer, 0, options.length)
uri.isSAFUri -> context.contentResolver.openOutputStream(uri)!!`;

describe("bounded Android document read compatibility", () => {
  it("builds the patched module from source instead of using Expo's prebuilt binary", () => {
    expect(require("../../package.json").expo.autolinking.android.buildFromSource)
      .toContain("expo-file-system");
    expect(require("../../app.json").expo.plugins).toContain("./plugins/withBoundedDocumentRead");
  });
  it("supports granted content providers without changing writes, and is idempotent", () => {
    const patched = patchBoundedDocumentRead(original);
    expect(patched).toContain('uri.scheme == "content" -> context.contentResolver.openInputStream(uri)!!');
    expect(patched).toContain("while (bytesRead < buffer.size)");
    expect(patched).toContain("uri.isSAFUri -> context.contentResolver.openOutputStream(uri)!!");
    expect(patchBoundedDocumentRead(patched)).toBe(patched);
  });

  it("fails closed if the upstream reader no longer matches", () => {
    expect(() => patchBoundedDocumentRead("changed source")).toThrow("review");
  });
});
