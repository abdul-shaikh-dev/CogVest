package com.abdulshaikh.cogvest.pbkdf2

import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/**
 * PBKDF2-HMAC-SHA256 from Android's own crypto provider, for
 * passphrase-protected backups (#760). It only calls the platform
 * implementation; CogVest writes no cryptography of its own.
 *
 * The password must be printable ASCII (the backup format passes the hex of
 * the passphrase's UTF-8 bytes), so every provider encodes it the same way.
 * Expo runs AsyncFunction bodies off the UI thread.
 */
class Pbkdf2Module : Module() {
  override fun definition() = ModuleDefinition {
    Name("CogVestPbkdf2")

    AsyncFunction("pbkdf2Sha256") { password: String, saltBase64: String, iterations: Int, keyLength: Int ->
      require(password.isNotEmpty() && password.length <= 4096 && password.all { it.code in 0x21..0x7e }) {
        "Password must be printable ASCII."
      }
      require(iterations in 1..2_000_000) { "Unsupported iteration count." }
      require(keyLength in 16..64) { "Unsupported key length." }
      val salt = Base64.decode(saltBase64, Base64.NO_WRAP)
      require(salt.size in 16..64) { "Unsupported salt length." }
      val chars = password.toCharArray()
      val spec = PBEKeySpec(chars, salt, iterations, keyLength * 8)
      try {
        val key = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
        try {
          Base64.encodeToString(key, Base64.NO_WRAP)
        } finally {
          key.fill(0)
        }
      } finally {
        spec.clearPassword()
        chars.fill('\u0000')
      }
    }
  }
}
