import { readFileSync } from "fs";
import path from "path";

const {
  assertBoundedReadLoop,
  patchBoundedDocumentRead,
} = require("../../plugins/withBoundedDocumentRead");

const original = `uri.isSAFUri -> context.contentResolver.openInputStream(uri)!!
uri.isSAFUri -> context.contentResolver.openOutputStream(uri)!!`;

const legacySource = (name: string) => readFileSync(path.join(
  path.dirname(require.resolve("expo-file-system/package.json")),
  "android/src/main/java/expo/modules/filesystem/legacy",
  name,
), "utf8");

describe("bounded Android document read compatibility", () => {
  it("builds the patched module from source instead of using Expo's prebuilt binary", () => {
    expect(require("../../package.json").expo.autolinking.android.buildFromSource)
      .toContain("expo-file-system");
    expect(require("../../app.json").expo.plugins).toContain("./plugins/withBoundedDocumentRead");
  });

  it("supports granted content providers without changing writes, and is idempotent", () => {
    const patched = patchBoundedDocumentRead(original);
    expect(patched).toContain('uri.scheme == "content" -> context.contentResolver.openInputStream(uri)!!');
    expect(patched).toContain("uri.isSAFUri -> context.contentResolver.openOutputStream(uri)!!");
    expect(patchBoundedDocumentRead(patched)).toBe(patched);
  });

  it("matches the installed Expo reader, which already reads byte ranges in a loop", () => {
    expect(() => patchBoundedDocumentRead(legacySource("FileSystemLegacyModule.kt"))).not.toThrow();
    expect(() => assertBoundedReadLoop(legacySource("FileSystemLegacyReader.kt"))).not.toThrow();
  });

  it("fails closed if the upstream reader no longer matches", () => {
    expect(() => patchBoundedDocumentRead("changed source")).toThrow("review");
    expect(() => assertBoundedReadLoop("val count = inputStream.read(buffer)")).toThrow("review");
  });
});
