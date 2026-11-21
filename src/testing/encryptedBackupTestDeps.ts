import { randomBytes as nodeRandomBytes, webcrypto } from "node:crypto";
import { scryptAsync } from "@noble/hashes/scrypt.js";

import type { BackupCipher, EncryptedBackupDeps } from "@/src/domain/encryptedBackup";

/** Copies into a plain ArrayBuffer, as WebCrypto requires. */
const own = (bytes: Uint8Array) => new Uint8Array(bytes);

/** Real AES-256-GCM from Node's WebCrypto, standing in for expo-crypto in tests. */
export const nodeBackupCipher: BackupCipher = {
  seal: async (key, nonce, plaintext, additionalData) => {
    const cryptoKey = await webcrypto.subtle.importKey("raw", own(key), "AES-GCM", false, ["encrypt"]);
    return new Uint8Array(await webcrypto.subtle.encrypt(
      { name: "AES-GCM", iv: own(nonce), additionalData: own(additionalData), tagLength: 128 }, cryptoKey, own(plaintext),
    ));
  },
  open: async (key, nonce, sealed, additionalData) => {
    const cryptoKey = await webcrypto.subtle.importKey("raw", own(key), "AES-GCM", false, ["decrypt"]);
    return new Uint8Array(await webcrypto.subtle.decrypt(
      { name: "AES-GCM", iv: own(nonce), additionalData: own(additionalData), tagLength: 128 }, cryptoKey, own(sealed),
    ));
  },
};

export const nodeEncryptedBackupDeps: EncryptedBackupDeps = {
  cipher: nodeBackupCipher,
  kdf: (passphrase, salt, { logN, r, p, dkLen }) => scryptAsync(passphrase, salt, { N: 2 ** logN, r, p, dkLen }),
  randomBytes: (length) => new Uint8Array(nodeRandomBytes(length)),
};
