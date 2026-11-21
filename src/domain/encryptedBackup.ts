import { backupMaxBytes } from "@/src/domain/portfolioBackup";

/**
 * Passphrase-protected backup files (#760).
 *
 * The protected file wraps the exact text of an ordinary backup: scrypt turns
 * the passphrase into a 256-bit key, and AES-256-GCM encrypts the backup text.
 * The header (format, version, scrypt settings, nonce) is bound to the
 * ciphertext as GCM additional data, so changing any of it fails decryption.
 * The decrypted text is then read by the ordinary backup parser, which keeps
 * every existing validation rule. The passphrase is never stored.
 */
export const encryptedBackupFormat = "cogvest-encrypted-backup";
export const encryptedBackupFormatVersion = 1;
export const encryptedBackupCipherName = "AES-256-GCM";
export const encryptedBackupKdfName = "scrypt";

/** Accepted scrypt cost (log2 N) when reading; caps memory at 128 MiB. */
export const encryptedBackupMinLogN = 15;
export const encryptedBackupMaxLogN = 17;
export const encryptedBackupScryptR = 8;
export const encryptedBackupScryptP = 1;
export const encryptedBackupDefaultLogN = 17;

export const backupPassphraseMinLength = 8;
export const backupPassphraseMaxLength = 256;

const saltBytes = 16;
const nonceBytes = 12;
const tagBytes = 16;
const keyBytes = 32;

/** A protected file holds base64 of at most one full backup plus a small header. */
export const encryptedBackupMaxBytes = Math.ceil((backupMaxBytes + tagBytes) / 3) * 4 + 1024;

export type EncryptedBackupKdfParams = { logN: number; r: number; p: number };

export type BackupCipher = {
  /** AES-256-GCM. Returns ciphertext followed by the 16-byte tag. */
  seal: (key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array, additionalData: Uint8Array) => Promise<Uint8Array>;
  /** Rejects when the tag does not verify. */
  open: (key: Uint8Array, nonce: Uint8Array, sealed: Uint8Array, additionalData: Uint8Array) => Promise<Uint8Array>;
};

export type BackupKdf = (
  passphrase: Uint8Array,
  salt: Uint8Array,
  params: EncryptedBackupKdfParams & { dkLen: number },
) => Promise<Uint8Array>;

export type EncryptedBackupDeps = {
  cipher: BackupCipher;
  kdf: BackupKdf;
  randomBytes: (length: number) => Uint8Array;
};

export type EncryptedBackupErrorKind = "invalid-file" | "wrong-passphrase" | "invalid-passphrase";

export class EncryptedBackupError extends Error {
  constructor(readonly kind: EncryptedBackupErrorKind, message: string) {
    super(message);
    this.name = "EncryptedBackupError";
  }
}

type Header = {
  format: typeof encryptedBackupFormat;
  formatVersion: typeof encryptedBackupFormatVersion;
  kdf: { name: typeof encryptedBackupKdfName; logN: number; r: number; p: number; salt: string };
  cipher: { name: typeof encryptedBackupCipherName; nonce: string };
};

const encoder = new TextEncoder();

export function encodeBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x2000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x2000));
  }
  return btoa(binary);
}

function decodeBase64(value: unknown, label: string, exactLength?: number) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value) || value.length % 4 !== 0) {
    throw invalidFile(`${label} is not base64`);
  }
  let binary: string;
  try { binary = atob(value); } catch { throw invalidFile(`${label} is not base64`); }
  if (exactLength !== undefined && binary.length !== exactLength) throw invalidFile(`${label} has the wrong length`);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function invalidFile(reason: string) {
  return new EncryptedBackupError("invalid-file", `Invalid protected backup: ${reason}.`);
}

/** The passphrase rule, or undefined when it is acceptable. */
export function backupPassphraseProblem(passphrase: string) {
  const length = [...passphrase].length;
  if (passphrase.trim().length === 0) return "Enter a passphrase.";
  if (length < backupPassphraseMinLength) return `Use at least ${backupPassphraseMinLength} characters.`;
  if (length > backupPassphraseMaxLength) return `Use at most ${backupPassphraseMaxLength} characters.`;
  return undefined;
}

function passphraseBytes(passphrase: string) {
  // NFC so the same passphrase typed on another keyboard derives the same key.
  return encoder.encode(passphrase.normalize("NFC"));
}

/** Fixed key order: the bytes bound to the ciphertext must not depend on the file's key order. */
function additionalData(header: Header) {
  return encoder.encode(JSON.stringify({
    format: header.format,
    formatVersion: header.formatVersion,
    kdf: { name: header.kdf.name, logN: header.kdf.logN, r: header.kdf.r, p: header.kdf.p, salt: header.kdf.salt },
    cipher: { name: header.cipher.name, nonce: header.cipher.nonce },
  }));
}

function deriveKey(deps: EncryptedBackupDeps, passphrase: string, salt: Uint8Array, params: EncryptedBackupKdfParams) {
  return deps.kdf(passphraseBytes(passphrase), salt, { ...params, dkLen: keyBytes });
}

function requireExactKeys(value: unknown, keys: string[], label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw invalidFile(`${label} is not an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw invalidFile(`${label} has unexpected fields`);
  }
}

/** True when the text is a protected backup, judged by its format field alone. */
export function isEncryptedBackupText(text: string) {
  if (!text.trimStart().startsWith("{")) return false;
  try {
    const raw: unknown = JSON.parse(text);
    return typeof raw === "object" && raw !== null && (raw as { format?: unknown }).format === encryptedBackupFormat;
  } catch {
    return false;
  }
}

export type EncryptedBackup = {
  text: string;
  /** The derived key, so the caller can check the sealed text without deriving again. */
  key: Uint8Array;
};

export async function encryptBackupText(
  plainText: string,
  passphrase: string,
  deps: EncryptedBackupDeps,
  logN = encryptedBackupDefaultLogN,
): Promise<EncryptedBackup> {
  const problem = backupPassphraseProblem(passphrase);
  if (problem) throw new EncryptedBackupError("invalid-passphrase", problem);
  if (!Number.isInteger(logN) || logN < encryptedBackupMinLogN || logN > encryptedBackupMaxLogN) {
    throw new Error("Unsupported scrypt cost.");
  }
  const salt = deps.randomBytes(saltBytes);
  const nonce = deps.randomBytes(nonceBytes);
  if (salt.length !== saltBytes || nonce.length !== nonceBytes) throw new Error("Random bytes unavailable.");
  const params = { logN, r: encryptedBackupScryptR, p: encryptedBackupScryptP };
  const key = await deriveKey(deps, passphrase, salt, params);
  const header: Header = {
    format: encryptedBackupFormat,
    formatVersion: encryptedBackupFormatVersion,
    kdf: { name: encryptedBackupKdfName, ...params, salt: encodeBase64(salt) },
    cipher: { name: encryptedBackupCipherName, nonce: encodeBase64(nonce) },
  };
  const sealed = await deps.cipher.seal(key, nonce, encoder.encode(plainText), additionalData(header));
  return { key, text: JSON.stringify({ ...header, ciphertext: encodeBase64(sealed) }) };
}

type ParsedEncryptedBackup = { header: Header; salt: Uint8Array; nonce: Uint8Array; sealed: Uint8Array };

function parseEncryptedBackup(text: string): ParsedEncryptedBackup {
  if (typeof text !== "string" || encoder.encode(text).length > encryptedBackupMaxBytes) throw invalidFile("file exceeds the supported size");
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw invalidFile("file is not valid JSON"); }
  requireExactKeys(raw, ["format", "formatVersion", "kdf", "cipher", "ciphertext"], "envelope");
  if (raw.format !== encryptedBackupFormat || raw.formatVersion !== encryptedBackupFormatVersion) throw invalidFile("format version is unsupported");
  requireExactKeys(raw.kdf, ["name", "logN", "r", "p", "salt"], "key settings");
  requireExactKeys(raw.cipher, ["name", "nonce"], "cipher settings");
  const { kdf, cipher } = raw;
  if (kdf.name !== encryptedBackupKdfName || cipher.name !== encryptedBackupCipherName) throw invalidFile("encryption method is unsupported");
  if (typeof kdf.logN !== "number" || !Number.isInteger(kdf.logN)
    || kdf.logN < encryptedBackupMinLogN || kdf.logN > encryptedBackupMaxLogN
    || kdf.r !== encryptedBackupScryptR || kdf.p !== encryptedBackupScryptP) {
    throw invalidFile("key settings are unsupported");
  }
  const salt = decodeBase64(kdf.salt, "salt", saltBytes);
  const nonce = decodeBase64(cipher.nonce, "nonce", nonceBytes);
  const sealed = decodeBase64(raw.ciphertext, "ciphertext");
  if (sealed.length <= tagBytes || sealed.length > backupMaxBytes + tagBytes) throw invalidFile("ciphertext has the wrong length");
  return {
    header: {
      format: encryptedBackupFormat,
      formatVersion: encryptedBackupFormatVersion,
      kdf: { name: encryptedBackupKdfName, logN: kdf.logN, r: kdf.r, p: kdf.p, salt: kdf.salt as string },
      cipher: { name: encryptedBackupCipherName, nonce: cipher.nonce as string },
    },
    salt,
    nonce,
    sealed,
  };
}

/** Checks the envelope without the passphrase, so a damaged file is reported before asking for it. */
export function checkEncryptedBackupEnvelope(text: string) {
  parseEncryptedBackup(text);
}

async function openWithKey(parsed: ParsedEncryptedBackup, key: Uint8Array, deps: EncryptedBackupDeps) {
  let plain: Uint8Array;
  try {
    plain = await deps.cipher.open(key, parsed.nonce, parsed.sealed, additionalData(parsed.header));
  } catch {
    // GCM cannot tell a wrong passphrase from a changed file.
    throw new EncryptedBackupError("wrong-passphrase", "The passphrase is wrong, or the file has been changed.");
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(plain);
  } catch {
    throw invalidFile("contents are not text");
  }
}

/** Returns the ordinary backup text inside a protected file. */
export async function decryptBackupText(text: string, passphrase: string, deps: EncryptedBackupDeps) {
  const parsed = parseEncryptedBackup(text);
  if (passphrase.length === 0 || [...passphrase].length > backupPassphraseMaxLength) {
    throw new EncryptedBackupError("wrong-passphrase", "The passphrase is wrong, or the file has been changed.");
  }
  const key = await deriveKey(deps, passphrase, parsed.salt, parsed.header.kdf);
  return openWithKey(parsed, key, deps);
}

/** Opens a protected file with an already derived key: the export's self-check. */
export async function decryptBackupTextWithKey(text: string, key: Uint8Array, deps: EncryptedBackupDeps) {
  return openWithKey(parseEncryptedBackup(text), key, deps);
}
