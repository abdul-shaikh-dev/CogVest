import { readAsStringAsync } from "expo-file-system/legacy";
import { backupMaxBytes } from "@/src/domain/portfolioBackup";

// SDK 54 File.open() uses RandomAccessFile, which cannot open SAF content URIs.
// The legacy base64 read supports a native byte bound for document-provider URIs.
export async function readBoundedBackupFile(
  uri: string,
  read = readAsStringAsync,
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
