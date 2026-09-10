const { withDangerousMod } = require("expo/config-plugins");
const { readFile, writeFile } = require("fs/promises");
const path = require("path");

// SDK 54's legacy bounded reader rejects Downloads-provider URIs even when
// Android's picker granted access. Change only reads, not writes or permissions.
function patchBoundedDocumentRead(source) {
  const original = 'uri.isSAFUri -> context.contentResolver.openInputStream(uri)!!';
  const replacement = 'uri.scheme == "content" -> context.contentResolver.openInputStream(uri)!!';
  if (!source.includes(original) && !source.includes(replacement)) {
    throw new Error("Expo bounded document reader changed; review the compatibility patch.");
  }
  source = source.replace(original, replacement);
  const read = 'val bytesRead = inputStream.read(buffer, 0, options.length)';
  const boundedRead = `var bytesRead = 0
            while (bytesRead < buffer.size) {
              val count = inputStream.read(buffer, bytesRead, buffer.size - bytesRead)
              if (count <= 0) break
              bytesRead += count
            }`;
  if (!source.includes(read) && !source.includes(boundedRead)) {
    throw new Error("Expo bounded read loop changed; review the compatibility patch.");
  }
  return source.replace(read, boundedRead);
}

function withBoundedDocumentRead(config) {
  return withDangerousMod(config, ["android", async (mod) => {
    const packageRoot = path.dirname(require.resolve("expo-file-system/package.json", {
      paths: [mod.modRequest.projectRoot],
    }));
    const target = path.join(packageRoot, "android/src/main/java/expo/modules/filesystem/legacy/FileSystemLegacyModule.kt");
    const before = await readFile(target, "utf8");
    const after = patchBoundedDocumentRead(before);
    if (after !== before) await writeFile(target, after, "utf8");
    return mod;
  }]);
}

module.exports = withBoundedDocumentRead;
module.exports.patchBoundedDocumentRead = patchBoundedDocumentRead;
