import { Directory, File } from "expo-file-system";
import { readAsStringAsync } from "expo-file-system/legacy";

import {
  ppfCsvMaxBytes,
  ppfCsvByteLength,
  ppfCsvTemplate,
  ppfCsvTemplateFileName,
} from "@/src/domain/ppfCsv";

export { ppfCsvMaxBytes } from "@/src/domain/ppfCsv";

const tooLargeMessage = "The selected PPF CSV exceeds the 256 KB limit.";
const readErrorMessage =
  "The selected PPF CSV could not be read. Choose another file and try again.";
const saveErrorMessage =
  "The PPF CSV template could not be saved. Choose another folder and try again.";

function isCancelled(error: unknown) {
  return error instanceof Error && /cancelled|canceled/iu.test(error.message);
}

function selectedFileName(selected: { name?: string; uri: string }) {
  const declaredName = selected.name?.trim();
  const uriName = decodeURIComponent(selected.uri).split(/[\\/]/u).at(-1);

  if (declaredName && /\.csv$/iu.test(declaredName)) return declaredName;
  if (uriName && /\.csv$/iu.test(uriName)) return uriName;
  return "Selected CSV file";
}

function decodeBoundedBase64(encoded: string) {
  const maxEncodedBytes = Math.ceil((ppfCsvMaxBytes + 1) / 3) * 4;
  if (encoded.length > maxEncodedBytes) throw new Error(tooLargeMessage);

  // Hermes does not provide browser atob/TextEncoder globals. Decode the
  // native Base64 result without a polyfill; URI decoding rejects invalid UTF-8.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes: string[] = [];
  let bits = 0;
  let value = 0;
  for (const character of encoded.replace(/=+$/u, "")) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) throw new Error(readErrorMessage);
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push(`%${((value >>> bits) & 255).toString(16).padStart(2, "0")}`);
      if (bytes.length > ppfCsvMaxBytes) throw new Error(tooLargeMessage);
    }
  }
  return decodeURIComponent(bytes.join(""));
}

export async function pickPpfCsvFile(): Promise<
  { name: string; size: number; text: string } | undefined
> {
  try {
    const picked = await File.pickFileAsync(undefined, "text/*");
    const selected = Array.isArray(picked) ? picked[0] : picked;
    if (!selected) return undefined;

    const name = selectedFileName(selected);
    const size = Number(selected.size);
    if (Number.isFinite(size) && size > ppfCsvMaxBytes) {
      throw new Error(tooLargeMessage);
    }

    const encoded = await readAsStringAsync(selected.uri, {
        encoding: "base64",
        length: ppfCsvMaxBytes + 1,
        position: 0,
      });
    const text = decodeBoundedBase64(encoded);

    return { name, size: ppfCsvByteLength(text), text };
  } catch (error) {
    if (isCancelled(error)) return undefined;
    if (error instanceof Error && error.message === tooLargeMessage) throw error;
    throw new Error(readErrorMessage);
  }
}

export async function savePpfCsvTemplate(): Promise<string | undefined> {
  try {
    const directory = await Directory.pickDirectoryAsync();
    if (!directory) return undefined;
    const file = directory.createFile(ppfCsvTemplateFileName, "text/csv");
    await file.write(ppfCsvTemplate);
    return ppfCsvTemplateFileName;
  } catch (error) {
    if (isCancelled(error)) return undefined;
    throw new Error(saveErrorMessage);
  }
}
