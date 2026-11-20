import { readEpfoPassbook, type PassbookReadResult } from "@/src/domain/epf/passbook";

import {
  CasPdfExtractionError,
  extractCasPdfLocally,
  type CasPdfExtractionRuntime,
  type CasPdfSourceFile,
} from "./casPdfExtraction";

/**
 * Reads one EPFO Member Passbook PDF on the device (#740), through the same
 * local extraction path as CAS import. Nothing is uploaded, and the extracted
 * text is dropped once the passbook is read.
 */
export async function readEpfPassbookFile({ extractionRuntime, source }: {
  extractionRuntime?: CasPdfExtractionRuntime;
  source: CasPdfSourceFile;
}): Promise<PassbookReadResult> {
  try {
    const result = await extractCasPdfLocally({
      // The page count arrives with the text, so the passbook is read afterwards.
      consumeText: (text) => text,
      runtime: extractionRuntime,
      source,
    });
    return readEpfoPassbook(result.value, result.pageCount);
  } catch (error) {
    const code = error instanceof CasPdfExtractionError ? error.code : "extractFailed";
    const message = code === "passwordRequired" || code === "incorrectPassword"
      ? "This PDF is password-protected. EPFO passbooks downloaded from the member portal aren't, so download it again."
      : code === "emptyPdf" ? "No text was found in this PDF. Scanned passbooks can't be read."
        : error instanceof CasPdfExtractionError ? error.message : "This file could not be read on this device.";
    return { ok: false, reason: "notPassbook", message };
  }
}
