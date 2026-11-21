import { scryptAsync } from "@noble/hashes/scrypt.js";
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from "expo-crypto";

import type { EncryptedBackupDeps } from "@/src/domain/encryptedBackup";

const tagLength = 16;

/**
 * Native AES-256-GCM from expo-crypto, and scrypt from @noble/hashes (#760).
 * scryptAsync yields to the JS thread while it runs, so the screen stays
 * responsive during the deliberately slow key derivation.
 */
export const expoEncryptedBackupDeps: EncryptedBackupDeps = {
  cipher: {
    seal: async (key, nonce, plaintext, additionalData) => {
      const aesKey = await AESEncryptionKey.import(key);
      const sealed = await aesEncryptAsync(plaintext, aesKey, {
        additionalData,
        nonce: { bytes: nonce },
        tagLength,
      });
      return sealed.ciphertext({ includeTag: true });
    },
    open: async (key, nonce, sealed, additionalData) => {
      const aesKey = await AESEncryptionKey.import(key);
      return aesDecryptAsync(AESSealedData.fromParts(nonce, sealed, tagLength), aesKey, { additionalData });
    },
  },
  kdf: (passphrase, salt, { logN, r, p, dkLen }) => scryptAsync(passphrase, salt, { N: 2 ** logN, r, p, dkLen }),
  randomBytes: (length) => getRandomBytes(length),
};
