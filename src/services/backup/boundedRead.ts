import { readPickedFileBase64 } from "@/src/services/import-export/pickedFileRead";
import { backupMaxBytes } from "@/src/domain/portfolioBackup";

// Reads at most maxBytes + 1 bytes natively, for any picked document URI (#659, #772).
export async function readBoundedBackupFile(
  uri: string,
  read = readPickedFileBase64,
) {
  const encoded = await read(uri, {
    encoding: "base64", position: 0, length: backupMaxBytes + 1,
  });
  if (encoded.length > Math.ceil((backupMaxBytes + 1) / 3) * 4) {
    throw new Error("Backup exceeds the supported size.");
  }
  const binary = atob(encoded);
  if (binary.length > backupMaxBytes) throw new Error("Backup exceeds the supported size.");
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
