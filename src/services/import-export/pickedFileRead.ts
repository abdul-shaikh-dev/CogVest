import { File } from "expo-file-system";
import { readAsStringAsync, type ReadingOptions } from "expo-file-system/legacy";

/** The part of an expo-file-system FileHandle this reader uses. */
export type PickedFileHandle = {
  readonly size: number | null;
  readBytes(length: number): Promise<Uint8Array>;
  close(): void;
};

export type PickedFileReadDeps = {
  legacyRead: typeof readAsStringAsync;
  open: (uri: string) => PickedFileHandle;
};

const defaultDeps: PickedFileReadDeps = {
  legacyRead: readAsStringAsync,
  open: (uri) => new File(uri).open(),
};

/**
 * The legacy reader opens file:// URIs and content:// URIs from the external
 * storage provider only. Anything else, such as the Downloads provider's
 * `content://com.android.providers.downloads.documents/...`, it rejects as an
 * unsupported scheme (#772).
 */
export function needsFileHandleRead(uri: string) {
  return /^content:\/\//iu.test(uri) && !/^content:\/\/com\.android\.externalstorage/iu.test(uri);
}

function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x2000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x2000));
  }
  return btoa(binary);
}

/**
 * Reads the first `length` bytes of a picked file as Base64, a drop-in for the
 * legacy `readAsStringAsync(uri, { encoding: "base64", position: 0, length })`.
 *
 * URIs the legacy reader rejects go through a read-only file handle, which
 * opens any content URI with ContentResolver.openFileDescriptor and reads at
 * most `length` bytes natively, so the #659 size bound still holds. The handle
 * sizes its read from the descriptor, so an unknown or zero size (a provider
 * streaming through a pipe) is refused rather than read as an empty file.
 */
export async function readPickedFileBase64(
  uri: string,
  options: ReadingOptions = {},
  deps: PickedFileReadDeps = defaultDeps,
): Promise<string> {
  if (!needsFileHandleRead(uri)) return deps.legacyRead(uri, options);

  const { encoding, length, position } = options;
  if (encoding !== "base64" || (position ?? 0) !== 0 || typeof length !== "number" || !Number.isInteger(length) || length < 0) {
    throw new Error("Picked files are read as a bounded Base64 range from the start.");
  }

  const handle = deps.open(uri);
  try {
    const size = handle.size;
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
      throw new Error("The picked file's size is unavailable.");
    }
    return encodeBase64(await handle.readBytes(Math.min(size, length)));
  } finally {
    handle.close();
  }
}
