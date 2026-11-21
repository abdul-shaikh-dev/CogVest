import { pbkdf2, randomBytes as nodeRandomBytes, webcrypto } from "node:crypto";

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

/** Real PBKDF2-HMAC-SHA256 from Node, standing in for Android's in tests. */
export const nodeEncryptedBackupDeps: EncryptedBackupDeps = {
  cipher: nodeBackupCipher,
  kdf: (password, salt, { iterations, dkLen }) => new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, dkLen, "sha256", (error, key) => (error ? reject(error) : resolve(new Uint8Array(key))));
  }),
  randomBytes: (length) => new Uint8Array(nodeRandomBytes(length)),
};
