package com.cogvest.encryptionprobe;

import android.app.Instrumentation;
import android.os.Bundle;
import android.util.Base64;
import com.tencent.mmkv.MMKV;
import com.tencent.mmkv.MMKVConfig;
import com.tencent.mmkv.MMKVLogLevel;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import org.json.JSONObject;

/** Test-only APK. Never opens CogVest's package, files, keys, or portfolio. */
public final class Probe extends Instrumentation {
    private Bundle arguments;
    private static final String MARKER = "COGVEST_SYNTHETIC_ENCRYPTION_PROBE_218";

    @Override public void onCreate(Bundle args) {
        super.onCreate(args);
        arguments = args;
        start();
    }

    private MMKV open(String id, String key, boolean readOnly) {
        MMKVConfig config = new MMKVConfig();
        config.mode = MMKV.SINGLE_PROCESS_MODE | (readOnly ? MMKV.READ_ONLY_MODE : 0);
        config.aes256 = true;
        config.cryptKey = key;
        // Leave recovery at the native default, as the RN facade does.
        return MMKV.mmkvWithID(id, config);
    }

    private static String hash(byte[] data) throws Exception {
        StringBuilder result = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) {
            result.append(String.format("%02x", b & 255));
        }
        return result.toString();
    }

    private static byte[] bytes(File file) throws Exception {
        return Files.readAllBytes(file.toPath());
    }

    @Override public void onStart() {
        Bundle output = new Bundle();
        try {
            String fault = arguments.getString("fault", "valid");
            String mode = arguments.getString("mode", "readonly");
            if (!Arrays.asList("readonly", "writable", "lifecycle").contains(mode)) {
                throw new IllegalArgumentException("Unknown probe mode");
            }
            boolean readOnly = mode.equals("readonly");
            if (!Arrays.asList("valid", "wrong-key", "missing-key", "data-flip",
                    "data-truncate", "crc-flip", "crc-truncate").contains(fault)) {
                throw new IllegalArgumentException("Unknown synthetic fault");
            }
            String root = MMKV.initialize(getTargetContext(), MMKVLogLevel.LevelNone);
            // Each invocation gets a new synthetic store, including when a prior probe crashed.
            String id = "probe-" + java.util.UUID.randomUUID();
            byte[] random = new byte[24];
            new SecureRandom().nextBytes(random);
            String key = Base64.encodeToString(random, Base64.NO_WRAP);
            if (key.getBytes(StandardCharsets.UTF_8).length != 32) {
                throw new IllegalStateException("Unexpected encoded key length");
            }
            MMKV seed = open(id, key, false);
            if (!seed.encode("sentinel", MARKER) || !seed.encode("portfolio", MARKER.repeat(8))) {
                throw new IllegalStateException("Synthetic seed write failed");
            }
            seed.sync();
            seed.close();
            File data = new File(root, id);
            File crc = new File(root, id + ".crc");
            byte[] originalData = bytes(data);
            byte[] originalCrc = bytes(crc);
            boolean markerHidden = !new String(originalData, StandardCharsets.ISO_8859_1).contains(MARKER);

            if (fault.equals("data-flip")) {
                byte[] changed = originalData.clone();
                changed[16] ^= 0x40;
                Files.write(data.toPath(), changed);
            } else if (fault.equals("data-truncate")) {
                Files.write(data.toPath(), Arrays.copyOf(originalData, 8));
            } else if (fault.equals("crc-flip")) {
                byte[] changed = originalCrc.clone();
                changed[0] ^= 0x40;
                Files.write(crc.toPath(), changed);
            } else if (fault.equals("crc-truncate")) {
                Files.write(crc.toPath(), Arrays.copyOf(originalCrc, 4));
            }
            byte[] beforeData = bytes(data);
            byte[] beforeCrc = bytes(crc);
            String suppliedKey = key;
            if (fault.equals("wrong-key")) {
                suppliedKey = (key.charAt(0) == 'A' ? "B" : "A") + key.substring(1);
            } else if (fault.equals("missing-key")) {
                suppliedKey = null;
            }
            JSONObject preflight = new JSONObject();
            if (mode.equals("lifecycle")) {
                MMKV pre = open(id, suppliedKey, true);
                preflight.put("sentinelMatches", MARKER.equals(pre.decodeString("sentinel")));
                preflight.put("portfolioMatches", MARKER.repeat(8).equals(pre.decodeString("portfolio")));
                pre.close();
                preflight.put("dataUnchanged", Arrays.equals(beforeData, bytes(data)));
                preflight.put("crcUnchanged", Arrays.equals(beforeCrc, bytes(crc)));
                // Only simulate writable integration after a seemingly successful preflight.
                if (!preflight.getBoolean("sentinelMatches") || !preflight.getBoolean("portfolioMatches")) {
                    throw new IllegalStateException("Preflight rejected synthetic lifecycle case");
                }
            }
            boolean sentinelMatches = false;
            boolean portfolioMatches = false;
            String exception = "none";
            MMKV reopened = null;
            try {
                reopened = open(id, suppliedKey, readOnly);
                sentinelMatches = MARKER.equals(reopened.decodeString("sentinel"));
                portfolioMatches = MARKER.repeat(8).equals(reopened.decodeString("portfolio"));
            } catch (Exception error) {
                exception = error.getClass().getSimpleName();
            } finally {
                if (reopened != null) reopened.close();
            }
            byte[] afterData = bytes(data);
            byte[] afterCrc = bytes(crc);
            JSONObject result = new JSONObject();
            result.put("nativeVersion", MMKV.version());
            result.put("fault", fault);
            result.put("mode", mode);
            if (mode.equals("lifecycle")) result.put("preflight", preflight);
            result.put("keyBytes", 32);
            result.put("keyEntropyBits", 192);
            result.put("plaintextMarkerAbsent", markerHidden);
            result.put("sentinelMatches", sentinelMatches);
            result.put("portfolioMatches", portfolioMatches);
            result.put("exception", exception);
            result.put("dataUnchanged", Arrays.equals(beforeData, afterData));
            result.put("crcUnchanged", Arrays.equals(beforeCrc, afterCrc));
            result.put("beforeDataSha256", hash(beforeData));
            result.put("afterDataSha256", hash(afterData));
            result.put("beforeCrcSha256", hash(beforeCrc));
            result.put("afterCrcSha256", hash(afterCrc));
            output.putString("stream", "\n" + result + "\n");
            finish(-1, output);
        } catch (Exception error) {
            // No secrets or exception messages in output.
            output.putString("stream", "PROBE_ERROR " + error.getClass().getSimpleName());
            finish(1, output);
        }
    }
}
