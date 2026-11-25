import { Directory, File } from "expo-file-system";

import { decodeBoundedBase64Text } from "./boundedTextFile";
import { readPickedFileBase64 } from "./pickedFileRead";
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
  const result = decodeBoundedBase64Text(encoded, ppfCsvMaxBytes);
  if (result.status === "too-large") throw new Error(tooLargeMessage);
  return result.text;
}

type PickedPpfCsvFile = { name: string; size: number; text: string };

export async function pickPpfCsvFile(): Promise<PickedPpfCsvFile | undefined> {
  try {
    const picked = await File.pickFileAsync(undefined, "text/*");
    const selected = Array.isArray(picked) ? picked[0] : picked;
    if (!selected) return undefined;
    return await readPpfCsvFile(selected);
  } catch (error) {
    if (isCancelled(error)) return undefined;
    if (error instanceof Error && error.message === tooLargeMessage) throw error;
    throw new Error(readErrorMessage);
  }
}

/** Reads a chosen or shared PPF CSV (#771) within the 256 KB limit. */
export async function readPpfCsvFile(selected: { name?: string; size?: number | null; uri: string }): Promise<PickedPpfCsvFile> {
  try {
    const name = selectedFileName(selected);
    const size = Number(selected.size);
    if (Number.isFinite(size) && size > ppfCsvMaxBytes) {
      throw new Error(tooLargeMessage);
    }

    const encoded = await readPickedFileBase64(selected.uri, {
        encoding: "base64",
        length: ppfCsvMaxBytes + 1,
        position: 0,
      });
    const text = decodeBoundedBase64(encoded);

    return { name, size: ppfCsvByteLength(text), text };
  } catch (error) {
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
