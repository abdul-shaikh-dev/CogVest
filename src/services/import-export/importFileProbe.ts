import { File } from "expo-file-system";

import { detectImportFile, importFileProbeBytes, pdfDeclaresEncryption, type ImportFileKind } from "@/src/domain/importFileDetection";

/**
 * Reads only what detection needs from a picked or shared file (#771): its
 * first 4 KiB, and for a PDF its last 4 KiB, where the trailer declares
 * encryption. The file is never read whole here; the chosen import screen
 * reads it again through its own bounded reader.
 */

export type ImportFileRef = { mimeType?: string | null; name: string; size?: number | null; uri: string };

type ProbeHandle = {
  offset: number | null;
  readonly size: number | null;
  readBytes(length: number): Uint8Array | Promise<Uint8Array>;
  close(): void;
};

export type ImportFileProbeDeps = { open: (uri: string) => ProbeHandle };

const defaultDeps: ImportFileProbeDeps = { open: (uri) => new File(uri).open() as unknown as ProbeHandle };

function latin1(bytes: Uint8Array) {
  let text = "";
  for (let index = 0; index < bytes.length; index += 0x2000) {
    text += String.fromCharCode(...bytes.subarray(index, index + 0x2000));
  }
  return text;
}

export async function probeImportFile(file: ImportFileRef, deps: ImportFileProbeDeps = defaultDeps): Promise<ImportFileKind> {
  const handle = deps.open(file.uri);
  try {
    const size = handle.size ?? file.size ?? null;
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return "unknown";
    handle.offset = 0;
    const head = latin1(await handle.readBytes(Math.min(size, importFileProbeBytes)));
    let pdfEncrypted: boolean | undefined;
    if (head.startsWith("%PDF-")) {
      handle.offset = Math.max(0, size - importFileProbeBytes);
      pdfEncrypted = pdfDeclaresEncryption(latin1(await handle.readBytes(Math.min(size, importFileProbeBytes))));
    }
    return detectImportFile({ head, mimeType: file.mimeType, name: file.name, pdfEncrypted });
  } finally {
    handle.close();
  }
}
