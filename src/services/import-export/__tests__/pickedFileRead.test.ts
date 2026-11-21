jest.mock("expo-file-system", () => ({ File: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({ readAsStringAsync: jest.fn() }));

import {
  needsFileHandleRead,
  readPickedFileBase64,
  type PickedFileHandle,
  type PickedFileReadDeps,
} from "../pickedFileRead";
import { readBoundedTextFile } from "../boundedTextFile";

const downloadsUri = "content://com.android.providers.downloads.documents/document/msf%3A93";
const externalStorageUri = "content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fa.csv";
const encoder = new TextEncoder();

function handleFor(bytes: Uint8Array, size: number | null = bytes.length) {
  const handle = {
    close: jest.fn(),
    readBytes: jest.fn(async (length: number) => bytes.slice(0, length)),
    size,
  } satisfies PickedFileHandle;
  return handle;
}

function deps(handle?: PickedFileHandle): PickedFileReadDeps & { legacyRead: jest.Mock; open: jest.Mock } {
  return {
    legacyRead: jest.fn().mockResolvedValue("bGVnYWN5"),
    open: jest.fn(() => {
      if (!handle) throw new Error("no handle");
      return handle;
    }),
  };
}

const range = (length: number) => ({ encoding: "base64" as const, length, position: 0 });

describe("needsFileHandleRead (#772)", () => {
  it("sends only content URIs the legacy reader rejects to the file handle", () => {
    expect(needsFileHandleRead(downloadsUri)).toBe(true);
    expect(needsFileHandleRead("content://com.google.android.apps.docs.storage/document/x")).toBe(true);
    expect(needsFileHandleRead(externalStorageUri)).toBe(false);
    expect(needsFileHandleRead("file:///data/user/0/app/cache/a.csv")).toBe(false);
  });
});

describe("readPickedFileBase64 (#772)", () => {
  it("keeps the legacy read for external storage and file URIs", async () => {
    const reader = deps();

    await expect(readPickedFileBase64(externalStorageUri, range(10), reader)).resolves.toBe("bGVnYWN5");
    await expect(readPickedFileBase64("file:///cache/a.csv", range(10), reader)).resolves.toBe("bGVnYWN5");

    expect(reader.legacyRead).toHaveBeenCalledWith(externalStorageUri, range(10));
    expect(reader.open).not.toHaveBeenCalled();
  });

  it("reads a Downloads URI through a file handle and closes it", async () => {
    const handle = handleFor(encoder.encode("version,asset\n1,TCS\n"));
    const reader = deps(handle);

    const encoded = await readPickedFileBase64(downloadsUri, range(1024), reader);

    expect(atob(encoded)).toBe("version,asset\n1,TCS\n");
    expect(reader.legacyRead).not.toHaveBeenCalled();
    expect(handle.readBytes).toHaveBeenCalledWith(20);
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("never asks the handle for more than the bounded length", async () => {
    const handle = handleFor(new Uint8Array(5000).fill(65));
    const reader = deps(handle);

    const encoded = await readPickedFileBase64(downloadsUri, range(101), reader);

    expect(handle.readBytes).toHaveBeenCalledWith(101);
    expect(atob(encoded)).toHaveLength(101);
  });

  it("lets the bounded text reader report an oversized Downloads file", async () => {
    const reader = deps(handleFor(new Uint8Array(5000).fill(65)));

    await expect(
      readBoundedTextFile(downloadsUri, 100, (uri, options) => readPickedFileBase64(uri, options, reader)),
    ).resolves.toEqual({ status: "too-large" });
  });

  it("decodes multi-byte UTF-8 read through the handle", async () => {
    const reader = deps(handleFor(encoder.encode("name\nCafé ₹\n")));

    await expect(
      readBoundedTextFile(downloadsUri, 100, (uri, options) => readPickedFileBase64(uri, options, reader)),
    ).resolves.toEqual({ byteLength: 15, status: "ok", text: "name\nCafé ₹\n" });
  });

  it.each([null, 0, Number.NaN])("refuses a file whose size is %p rather than reading it as empty", async (size) => {
    const handle = handleFor(encoder.encode("data"), size);

    await expect(readPickedFileBase64(downloadsUri, range(100), deps(handle))).rejects.toThrow(
      "The picked file's size is unavailable.",
    );
    expect(handle.readBytes).not.toHaveBeenCalled();
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("closes the handle when the read fails", async () => {
    const handle = handleFor(encoder.encode("data"));
    handle.readBytes.mockRejectedValueOnce(new Error("provider went away"));

    await expect(readPickedFileBase64(downloadsUri, range(100), deps(handle))).rejects.toThrow("provider went away");
    expect(handle.close).toHaveBeenCalledTimes(1);
  });

  it("passes on a failure to open the file", async () => {
    await expect(readPickedFileBase64(downloadsUri, range(100), deps())).rejects.toThrow("no handle");
  });

  it.each([
    { encoding: "utf8" as const, length: 10, position: 0 },
    { encoding: "base64" as const, length: 10, position: 5 },
    { encoding: "base64" as const },
    { encoding: "base64" as const, length: -1, position: 0 },
  ])("refuses a handle read other than a bounded Base64 range from the start: %p", async (options) => {
    const reader = deps(handleFor(encoder.encode("data")));

    await expect(readPickedFileBase64(downloadsUri, options, reader)).rejects.toThrow(
      "Picked files are read as a bounded Base64 range from the start.",
    );
    expect(reader.open).not.toHaveBeenCalled();
  });
});
