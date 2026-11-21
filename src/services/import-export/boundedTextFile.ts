import type { readAsStringAsync } from "expo-file-system/legacy";

import { readPickedFileBase64 } from "./pickedFileRead";

export type BoundedTextRead =
  | { byteLength: number; status: "ok"; text: string }
  | { status: "too-large" };

const base64Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/**
 * Decodes Base64 into UTF-8 text, stopping as soon as the bytes pass maxBytes.
 * Hermes has no browser atob/TextEncoder globals, so this decodes without a
 * polyfill; URI decoding throws on invalid UTF-8.
 */
export function decodeBoundedBase64Text(encoded: string, maxBytes: number): BoundedTextRead {
  if (encoded.length > Math.ceil((maxBytes + 1) / 3) * 4) return { status: "too-large" };

  const bytes: string[] = [];
  let bits = 0;
  let value = 0;
  for (const character of encoded.replace(/=+$/u, "")) {
    const digit = base64Alphabet.indexOf(character);
    if (digit < 0) throw new Error("The file is not valid Base64.");
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push(`%${((value >>> bits) & 255).toString(16).padStart(2, "0")}`);
      if (bytes.length > maxBytes) return { status: "too-large" };
    }
  }
  return { byteLength: bytes.length, status: "ok", text: decodeURIComponent(bytes.join("")) };
}

/**
 * Reads at most maxBytes + 1 bytes of a picked file natively, so a file larger
 * than the limit never reaches JavaScript memory whatever size its provider
 * declared (#659), whichever document provider served it (#772).
 */
export async function readBoundedTextFile(
  uri: string,
  maxBytes: number,
  read: typeof readAsStringAsync = readPickedFileBase64,
): Promise<BoundedTextRead> {
  const encoded = await read(uri, { encoding: "base64", length: maxBytes + 1, position: 0 });
  return decodeBoundedBase64Text(encoded, maxBytes);
}

/**
 * Reads a picked CSV within maxBytes. An oversized file comes back with empty
 * text and a size over the limit, which the import screens already report as
 * too large. The declared size is only an early check: it may be missing, NaN
 * or wrong, so the bounded read decides.
 */
export async function readPickedCsvFile(
  selected: { size?: number; uri: string },
  maxBytes: number,
  read: typeof readAsStringAsync = readPickedFileBase64,
): Promise<{ size: number; text: string }> {
  const declared = Number(selected.size);
  if (Number.isFinite(declared) && declared > maxBytes) return { size: declared, text: "" };

  const result = await readBoundedTextFile(selected.uri, maxBytes, read);
  return result.status === "ok"
    ? { size: result.byteLength, text: result.text }
    : { size: maxBytes + 1, text: "" };
}
