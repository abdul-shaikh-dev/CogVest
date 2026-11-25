package com.abdulshaikh.cogvest.shareintent

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Receives a statement file shared to CogVest (#771).
 *
 * Only ACTION_SEND with one stream is accepted. The module hands JS the URI,
 * display name, size and type; it never reads the file. Each share is taken
 * once: the intent is marked handled so a later read, or a recreated activity
 * in the same process, does not import it twice.
 */
class ShareIntentModule : Module() {
  private val handledExtra = "com.abdulshaikh.cogvest.shareHandled"

  @Suppress("DEPRECATION")
  private fun streamOf(intent: Intent): Uri? =
    if (Build.VERSION.SDK_INT >= 33) {
      intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
      intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
    }

  private fun describe(uri: Uri, intent: Intent): Map<String, Any?> {
    val resolver = appContext.reactContext?.contentResolver
    var name: String? = null
    var size: Long? = null
    try {
      resolver?.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
          val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
          val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
          if (nameIndex >= 0 && !cursor.isNull(nameIndex)) name = cursor.getString(nameIndex)
          if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
        }
      }
    } catch (error: Throwable) {
      Log.w("CogVestShareIntent", "Could not describe the shared file: ${error.message}")
    }
    val type = try { resolver?.getType(uri) } catch (error: Throwable) { null } ?: intent.type
    return mapOf(
      "mimeType" to type,
      "name" to (name ?: uri.lastPathSegment ?: "Shared file"),
      "size" to size?.toDouble(),
      "uri" to uri.toString(),
    )
  }

  override fun definition() = ModuleDefinition {
    Name("CogVestShareIntent")

    Events("onShare")

    Function("takeSharedFile") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      if (intent.action != Intent.ACTION_SEND || intent.getBooleanExtra(handledExtra, false)) {
        return@Function null
      }
      val uri = streamOf(intent) ?: return@Function null
      intent.putExtra(handledExtra, true)
      describe(uri, intent)
    }

    OnNewIntent { intent ->
      if (intent.action != Intent.ACTION_SEND) return@OnNewIntent
      appContext.currentActivity?.intent = intent
      sendEvent("onShare", mapOf<String, Any?>())
    }
  }
}
