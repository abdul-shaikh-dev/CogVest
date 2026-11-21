import {
  backupKdfPassword,
  backupPassphraseProblem,
  checkEncryptedBackupEnvelope,
  decryptBackupText,
  decryptBackupTextWithKey,
  encodeBase64,
  encryptBackupText,
  encryptedBackupDefaultIterations,
  encryptedBackupFormat,
  encryptedBackupMaxBytes,
  encryptedBackupMaxIterations,
  encryptedBackupMinIterations,
  EncryptedBackupError,
  isEncryptedBackupText,
} from "@/src/domain/encryptedBackup";
import { nodeEncryptedBackupDeps as deps } from "@/src/testing/encryptedBackupTestDeps";

const plain = JSON.stringify({ format: "cogvest-portfolio-backup", note: "Synthetic ₹1,23,456.78 marker-7f3a" });
const passphrase = "orbit lantern basil 42";

async function sealed() {
  return (await encryptBackupText(plain, passphrase, deps)).text;
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
      kdf: { name: "PBKDF2-HMAC-SHA256", iterations: 600_000 },
      cipher: { name: "AES-256-GCM" },
    });
    await expect(decryptBackupText(text, passphrase, deps)).resolves.toBe(plain);
  });

  it("derives from the hex of the NFC UTF-8 passphrase with the stated settings", async () => {
    expect(backupKdfPassword("café")).toBe("636166c3a9");
    expect(backupKdfPassword("café")).toBe("636166c3a9");
    const kdf = jest.fn(deps.kdf);
    await encryptBackupText(plain, "café crème", { ...deps, kdf });
    expect(kdf).toHaveBeenCalledWith(backupKdfPassword("café crème"), expect.any(Uint8Array),
      { iterations: encryptedBackupDefaultIterations, dkLen: 32 });
    expect(kdf.mock.calls[0][1]).toHaveLength(16);
  });

  it("uses a new salt and nonce for every file", async () => {
    const [first, second] = [JSON.parse(await sealed()), JSON.parse(await sealed())];
    expect(first.kdf.salt).not.toBe(second.kdf.salt);
    expect(first.cipher.nonce).not.toBe(second.cipher.nonce);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("lets the export check its own file with the derived key", async () => {
    const result = await encryptBackupText(plain, passphrase, deps);
    await expect(decryptBackupTextWithKey(result.text, result.key, deps)).resolves.toBe(plain);
  });

  it("rejects a wrong passphrase without revealing anything", async () => {
    const text = await sealed();
    await expectKind(decryptBackupText(text, "orbit lantern basil 43", deps), "wrong-passphrase");
    await expectKind(decryptBackupText(text, "", deps), "wrong-passphrase");
  });

  it("rejects a changed ciphertext, salt, nonce or iteration count", async () => {
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
      edit(text, (raw) => { raw.kdf.iterations = 600_001; }),
    ]) {
      await expectKind(decryptBackupText(changed, passphrase, deps), "wrong-passphrase");
    }
  });

  it("does not depend on the order of the file's fields", async () => {
    const raw = JSON.parse(await sealed());
    const reordered = JSON.stringify({
      ciphertext: raw.ciphertext,
      cipher: { nonce: raw.cipher.nonce, name: raw.cipher.name },
      kdf: { salt: raw.kdf.salt, iterations: raw.kdf.iterations, name: raw.kdf.name },
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
      edit(text, (raw) => { raw.kdf.name = "scrypt"; }),
      edit(text, (raw) => { raw.cipher.name = "AES-128-GCM"; }),
      edit(text, (raw) => { raw.kdf.iterations = encryptedBackupMinIterations - 1; }),
      edit(text, (raw) => { raw.kdf.iterations = encryptedBackupMaxIterations + 1; }),
      edit(text, (raw) => { raw.kdf.iterations = 600_000.5; }),
      edit(text, (raw) => { raw.kdf.iterations = "600000"; }),
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
    expect(() => checkEncryptedBackupEnvelope(edit(text, (raw) => { raw.kdf.iterations = 1; }))).toThrow(EncryptedBackupError);
  });

  it("derives the same key from either Unicode form of a passphrase", async () => {
    const composed = "café crème brûlée";
    const text = (await encryptBackupText(plain, composed, deps)).text;
    await expect(decryptBackupText(text, composed.normalize("NFD"), deps)).resolves.toBe(plain);
  });

  it("requires a passphrase of at least 8 characters", async () => {
    expect(backupPassphraseProblem("")).toBe("Enter a passphrase.");
    expect(backupPassphraseProblem("        ")).toBe("Enter a passphrase.");
    expect(backupPassphraseProblem("seven77")).toBe("Use at least 8 characters.");
    expect(backupPassphraseProblem("eight888")).toBeUndefined();
    expect(backupPassphraseProblem("x".repeat(257))).toBe("Use at most 256 characters.");
    await expectKind(encryptBackupText(plain, "short", deps), "invalid-passphrase");
  });

  it("refuses an unsupported iteration count when encrypting", async () => {
    await expect(encryptBackupText(plain, passphrase, deps, encryptedBackupMinIterations - 1)).rejects.toThrow("Unsupported key iteration count.");
    await expect(encryptBackupText(plain, passphrase, deps, encryptedBackupMaxIterations + 1)).rejects.toThrow("Unsupported key iteration count.");
  });

  it("refuses a key of the wrong length", async () => {
    await expect(encryptBackupText(plain, passphrase, { ...deps, kdf: async () => new Uint8Array(16) }))
      .rejects.toThrow("Key derivation returned the wrong length.");
  });

  it("tells protected files from ordinary backups", async () => {
    expect(isEncryptedBackupText(await sealed())).toBe(true);
    expect(isEncryptedBackupText(plain)).toBe(false);
    expect(isEncryptedBackupText("not json")).toBe(false);
    expect(isEncryptedBackupText("null")).toBe(false);
  });

  it("matches a fixed file, so the format cannot drift unnoticed", async () => {
    const fixed = {
      ...deps,
      randomBytes: (length: number) => new Uint8Array(length).fill(length === 16 ? 1 : 2),
    };
    const result = await encryptBackupText("synthetic", "fixed passphrase", fixed);
    expect(result.text).toBe(KNOWN_FILE);
    await expect(decryptBackupText(KNOWN_FILE, "fixed passphrase", deps)).resolves.toBe("synthetic");
  });
});

// Salt 0x01 x16, nonce 0x02 x12, passphrase "fixed passphrase", plaintext "synthetic".
const KNOWN_FILE = '{"format":"cogvest-encrypted-backup","formatVersion":1,"kdf":{"name":"PBKDF2-HMAC-SHA256","iterations":600000,"salt":"AQEBAQEBAQEBAQEBAQEBAQ=="},"cipher":{"name":"AES-256-GCM","nonce":"AgICAgICAgICAgIC"},"ciphertext":"tjbB7SkOAgJ/D4TfeOQAO+Dckg+dnRdCJA=="}';
