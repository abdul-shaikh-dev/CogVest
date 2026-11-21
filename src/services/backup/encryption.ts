import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, getRandomBytes } from "expo-crypto";

import { isPbkdf2Available, pbkdf2Sha256Async } from "@/modules/cogvest-pbkdf2";
import { encodeBase64, type EncryptedBackupDeps } from "@/src/domain/encryptedBackup";

const tagLength = 16;

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

/**
 * Native crypto for passphrase-protected backups (#760): Android's
 * PBKDF2-HMAC-SHA256 through the local CogVestPbkdf2 module, and AES-256-GCM
 * from expo-crypto. Undefined where the PBKDF2 module is absent, which turns
 * protection off rather than falling back to a slow JavaScript derivation.
 */
export const expoEncryptedBackupDeps: EncryptedBackupDeps | undefined = isPbkdf2Available ? {
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
  kdf: async (password, salt, { iterations, dkLen }) =>
    decodeBase64(await pbkdf2Sha256Async(password, encodeBase64(salt), iterations, dkLen)),
  randomBytes: (length) => getRandomBytes(length),
} : undefined;
