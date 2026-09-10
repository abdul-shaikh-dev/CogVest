import { readBoundedBackupFile } from "../boundedRead";
import { backupMaxBytes } from "@/src/domain/portfolioBackup";

describe("bounded backup document read", () => {
  it("sets a native byte bound rather than trusting provider metadata", async () => {
    const text = '{"name":"Synthetic ₹ portfolio"}';
    const read = jest.fn(async () => Buffer.from(text).toString("base64"));
    expect(await readBoundedBackupFile("content://synthetic", read)).toBe(text);
    expect(read).toHaveBeenCalledWith("content://synthetic", { encoding: "base64", position: 0, length: backupMaxBytes + 1 });
  });
  it("rejects the sentinel byte beyond the size limit", async () => {
    const read = jest.fn(async () => Buffer.alloc(backupMaxBytes + 1, 32).toString("base64"));
    await expect(readBoundedBackupFile("content://synthetic", read)).rejects.toThrow("size");
  });
  it("rejects malformed UTF-8 and unreadable files", async () => {
    await expect(readBoundedBackupFile("content://synthetic", async () => "/w==")).rejects.toThrow();
    await expect(readBoundedBackupFile("content://synthetic", async () => { throw new Error("Access denied"); })).rejects.toThrow();
  });
});
