import {
  backupPassphraseProblem,
  checkEncryptedBackupEnvelope,
  decryptBackupText,
  decryptBackupTextWithKey,
  encodeBase64,
  encryptBackupText,
  encryptedBackupFormat,
  encryptedBackupMaxBytes,
  EncryptedBackupError,
  isEncryptedBackupText,
} from "@/src/domain/encryptedBackup";
import { nodeEncryptedBackupDeps as deps } from "@/src/testing/encryptedBackupTestDeps";

const plain = JSON.stringify({ format: "cogvest-portfolio-backup", note: "Synthetic ₹1,23,456.78 marker-7f3a" });
const passphrase = "orbit lantern basil 42";
// The lowest accepted cost keeps the suite fast; the cost itself is checked separately.
const logN = 15;

async function sealed() {
  return (await encryptBackupText(plain, passphrase, deps, logN)).text;
}

async function expectKind(promise: Promise<unknown>, kind: string) {
  await expect(promise).rejects.toBeInstanceOf(EncryptedBackupError);
  await expect(promise).rejects.toMatchObject({ kind });
}

function edit(text: string, change: (raw: Record<string, any>) => void) {
  const raw = JSON.parse(text);
  change(raw);
  return JSON.stringify(raw);
}

describe("passphrase-protected backups (#760)", () => {
  it("returns the exact backup text with the right passphrase and hides it in the file", async () => {
    const text = await sealed();
    expect(text).not.toContain("marker-7f3a");
    expect(text).not.toContain("1,23,456");
    const raw = JSON.parse(text);
    expect(Object.keys(raw).sort()).toEqual(["cipher", "ciphertext", "format", "formatVersion", "kdf"]);
    expect(raw).toMatchObject({
      format: encryptedBackupFormat,
      formatVersion: 1,
      kdf: { name: "scrypt", logN, r: 8, p: 1 },
      cipher: { name: "AES-256-GCM" },
    });
    await expect(decryptBackupText(text, passphrase, deps)).resolves.toBe(plain);
  });

  it("uses a new salt and nonce for every file", async () => {
    const [first, second] = [JSON.parse(await sealed()), JSON.parse(await sealed())];
    expect(first.kdf.salt).not.toBe(second.kdf.salt);
    expect(first.cipher.nonce).not.toBe(second.cipher.nonce);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("lets the export check its own file with the derived key", async () => {
    const result = await encryptBackupText(plain, passphrase, deps, logN);
    await expect(decryptBackupTextWithKey(result.text, result.key, deps)).resolves.toBe(plain);
  });

  it("rejects a wrong passphrase without revealing anything", async () => {
    const text = await sealed();
    await expectKind(decryptBackupText(text, "orbit lantern basil 43", deps), "wrong-passphrase");
    await expectKind(decryptBackupText(text, "", deps), "wrong-passphrase");
  });

  it("rejects a changed ciphertext, salt, nonce or cost", async () => {
    const text = await sealed();
    const flip = (value: string) => {
      const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
      bytes[0] ^= 1;
      return encodeBase64(bytes);
    };
    for (const changed of [
      edit(text, (raw) => { raw.ciphertext = flip(raw.ciphertext); }),
      edit(text, (raw) => { raw.kdf.salt = flip(raw.kdf.salt); }),
      edit(text, (raw) => { raw.cipher.nonce = flip(raw.cipher.nonce); }),
      edit(text, (raw) => { raw.kdf.logN = 16; }),
    ]) {
      await expectKind(decryptBackupText(changed, passphrase, deps), "wrong-passphrase");
    }
  });

  it("does not depend on the order of the file's fields", async () => {
    const raw = JSON.parse(await sealed());
    const reordered = JSON.stringify({
      ciphertext: raw.ciphertext,
      cipher: { nonce: raw.cipher.nonce, name: raw.cipher.name },
      kdf: { salt: raw.kdf.salt, p: raw.kdf.p, r: raw.kdf.r, logN: raw.kdf.logN, name: raw.kdf.name },
      formatVersion: raw.formatVersion,
      format: raw.format,
    });
    await expect(decryptBackupText(reordered, passphrase, deps)).resolves.toBe(plain);
  });

  it("rejects unsupported or malformed envelopes before deriving a key", async () => {
    const text = await sealed();
    const kdf = jest.fn(deps.kdf);
    const counted = { ...deps, kdf };
    for (const bad of [
      "{",
      "[]",
      edit(text, (raw) => { raw.extra = true; }),
      edit(text, (raw) => { raw.formatVersion = 2; }),
      edit(text, (raw) => { raw.kdf.name = "pbkdf2"; }),
      edit(text, (raw) => { raw.cipher.name = "AES-128-GCM"; }),
      edit(text, (raw) => { raw.kdf.logN = 18; }),
      edit(text, (raw) => { raw.kdf.logN = 14; }),
      edit(text, (raw) => { raw.kdf.logN = 15.5; }),
      edit(text, (raw) => { raw.kdf.r = 1; }),
      edit(text, (raw) => { raw.kdf.p = 2; }),
      edit(text, (raw) => { raw.kdf.extra = 1; }),
      edit(text, (raw) => { raw.kdf.salt = "AAAA"; }),
      edit(text, (raw) => { raw.cipher.nonce = "not base64!"; }),
      edit(text, (raw) => { raw.ciphertext = encodeBase64(new Uint8Array(16)); }),
      edit(text, (raw) => { delete raw.ciphertext; }),
      " ".repeat(encryptedBackupMaxBytes + 1),
    ]) {
      await expectKind(decryptBackupText(bad, passphrase, counted), "invalid-file");
    }
    expect(kdf).not.toHaveBeenCalled();
    expect(() => checkEncryptedBackupEnvelope(text)).not.toThrow();
    expect(() => checkEncryptedBackupEnvelope(edit(text, (raw) => { raw.kdf.logN = 18; }))).toThrow(EncryptedBackupError);
  });

  it("derives the same key from either Unicode form of a passphrase", async () => {
    const composed = "café crème brûlée";
    const text = (await encryptBackupText(plain, composed, deps, logN)).text;
    await expect(decryptBackupText(text, composed.normalize("NFD"), deps)).resolves.toBe(plain);
  });

  it("requires a passphrase of at least 8 characters", async () => {
    expect(backupPassphraseProblem("")).toBe("Enter a passphrase.");
    expect(backupPassphraseProblem("        ")).toBe("Enter a passphrase.");
    expect(backupPassphraseProblem("seven77")).toBe("Use at least 8 characters.");
    expect(backupPassphraseProblem("eight888")).toBeUndefined();
    expect(backupPassphraseProblem("x".repeat(257))).toBe("Use at most 256 characters.");
    await expectKind(encryptBackupText(plain, "short", deps, logN), "invalid-passphrase");
  });

  it("refuses an unsupported cost when encrypting", async () => {
    await expect(encryptBackupText(plain, passphrase, deps, 14)).rejects.toThrow("Unsupported scrypt cost.");
    await expect(encryptBackupText(plain, passphrase, deps, 18)).rejects.toThrow("Unsupported scrypt cost.");
  });

  it("tells protected files from ordinary backups", async () => {
    expect(isEncryptedBackupText(await sealed())).toBe(true);
    expect(isEncryptedBackupText(plain)).toBe(false);
    expect(isEncryptedBackupText("not json")).toBe(false);
    expect(isEncryptedBackupText("null")).toBe(false);
  });

  it("produces the same file from the same salt, nonce and passphrase", async () => {
    const fixed = {
      ...deps,
      randomBytes: (length: number) => new Uint8Array(length).fill(length === 16 ? 1 : 2),
    };
    const first = await encryptBackupText("synthetic", "fixed passphrase", fixed, logN);
    const second = await encryptBackupText("synthetic", "fixed passphrase", fixed, logN);
    expect(first.text).toBe(second.text);
    await expect(decryptBackupText(first.text, "fixed passphrase", deps)).resolves.toBe("synthetic");
  });
});
