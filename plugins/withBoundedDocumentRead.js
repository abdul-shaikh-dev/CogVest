const { withDangerousMod } = require("expo/config-plugins");
const { readFile, writeFile } = require("fs/promises");
const path = require("path");

// Expo's legacy reader rejects Downloads-provider URIs even when Android's
// picker granted access. Change only reads, not writes or permissions.
function patchBoundedDocumentRead(source) {
  const original = 'uri.isSAFUri -> context.contentResolver.openInputStream(uri)!!';
  const replacement = 'uri.scheme == "content" -> context.contentResolver.openInputStream(uri)!!';
  if (!source.includes(original) && !source.includes(replacement)) {
    throw new Error("Expo bounded document reader changed; review the compatibility patch.");
  }
  return source.replace(original, replacement);
}

// From SDK 57 Expo reads a byte range in a loop until it is full, which our
// patch used to add. Fail closed if that loop ever disappears.
function assertBoundedReadLoop(readerSource) {
  const loop = "val bytesRead = read(buffer, offset, length - offset)";
  if (!readerSource.includes("while (offset < length)") || !readerSource.includes(loop)) {
    throw new Error("Expo bounded read loop changed; review the compatibility patch.");
  }
}

function withBoundedDocumentRead(config) {
  return withDangerousMod(config, ["android", async (mod) => {
    const packageRoot = path.dirname(require.resolve("expo-file-system/package.json", {
      paths: [mod.modRequest.projectRoot],
    }));
    const legacy = path.join(packageRoot, "android/src/main/java/expo/modules/filesystem/legacy");
    assertBoundedReadLoop(await readFile(path.join(legacy, "FileSystemLegacyReader.kt"), "utf8"));
    const target = path.join(legacy, "FileSystemLegacyModule.kt");
    const before = await readFile(target, "utf8");
    const after = patchBoundedDocumentRead(before);
    if (after !== before) await writeFile(target, after, "utf8");
    return mod;
  }]);
}

module.exports = withBoundedDocumentRead;
module.exports.assertBoundedReadLoop = assertBoundedReadLoop;
module.exports.patchBoundedDocumentRead = patchBoundedDocumentRead;
