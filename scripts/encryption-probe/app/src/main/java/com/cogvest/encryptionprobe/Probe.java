package com.cogvest.encryptionprobe;

import android.app.Instrumentation;
import android.os.Bundle;
import android.util.Base64;
import com.tencent.mmkv.MMKV;
import com.tencent.mmkv.MMKVConfig;
import com.tencent.mmkv.MMKVLogLevel;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
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
        if (data == null) return "MISSING";
        StringBuilder result = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(data)) {
            result.append(String.format("%02x", b & 255));
        }
        return result.toString();
    }

    private static byte[] bytes(File file) throws Exception {
        return file.exists() ? Files.readAllBytes(file.toPath()) : null;
    }

    @Override public void onStart() {
        Bundle output = new Bundle();
        try {
            String fault = arguments.getString("fault", "valid");
            String mode = arguments.getString("mode", "readonly");
            if (!Arrays.asList("readonly", "writable", "lifecycle", "guarded", "format-guarded").contains(mode)) {
                throw new IllegalArgumentException("Unknown probe mode");
            }
            boolean readOnly = mode.equals("readonly");
            if (!Arrays.asList("valid", "valid-large", "valid-compacted", "wrong-key", "missing-key", "data-flip",
                    "data-truncate", "crc-flip", "crc-truncate", "data-empty", "crc-empty",
                    "data-missing", "crc-missing", "both-missing", "metadata-version",
                    "metadata-flags", "metadata-iv", "metadata-size", "padding-append",
                    "padding-truncate", "metadata-sequence", "metadata-last-size",
                    "metadata-last-crc", "crc-and-last-size", "crc-and-last-crc").contains(fault)) {
                throw new IllegalArgumentException("Unknown synthetic fault");
            }
            String root = MMKV.initialize(getTargetContext(), MMKVLogLevel.LevelNone);
            // Each invocation gets a new synthetic store, including when a prior probe crashed.
            String id = "probe-" + java.util.UUID.randomUUID();
            byte[] random = new byte[24];
            new SecureRandom().nextBytes(random);
            String key = Base64.encodeToString(random, Base64.NO_WRAP);
            String payload = MARKER.repeat(fault.equals("valid-large") ? 4000 : 8);
            if (key.getBytes(StandardCharsets.UTF_8).length != 32) {
                throw new IllegalStateException("Unexpected encoded key length");
            }
            MMKV seed = open(id, key, false);
            if (!seed.encode("sentinel", MARKER) || !seed.encode("portfolio", payload)) {
                throw new IllegalStateException("Synthetic seed write failed");
            }
            if (fault.equals("valid-compacted")) {
                if (!seed.encode("temporary", MARKER.repeat(1000))) {
                    throw new IllegalStateException("Compaction fixture write failed");
                }
                seed.removeValueForKey("temporary");
                seed.trim();
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
            } else if (fault.equals("data-empty")) {
                Files.write(data.toPath(), new byte[0]);
            } else if (fault.equals("crc-empty")) {
                Files.write(crc.toPath(), new byte[0]);
            } else if (fault.equals("data-missing")) {
                Files.delete(data.toPath());
            } else if (fault.equals("crc-missing")) {
                Files.delete(crc.toPath());
            } else if (fault.equals("both-missing")) {
                Files.delete(data.toPath());
                Files.delete(crc.toPath());
            } else if (fault.equals("padding-append")) {
                Files.write(data.toPath(), Arrays.copyOf(originalData, originalData.length + 1));
            } else if (fault.equals("padding-truncate")) {
                Files.write(data.toPath(), Arrays.copyOf(originalData, originalData.length - 1));
            } else if (fault.startsWith("crc-and-last-")) {
                byte[] changed = originalCrc.clone();
                changed[0] ^= 0x40;
                changed[fault.equals("crc-and-last-size") ? 32 : 36] ^= 0x40;
                Files.write(crc.toPath(), changed);
            } else if (fault.startsWith("metadata-")) {
                // Fault offsets match the pinned v2.4.0 MMKVMetaInfo layout, not a guard parser.
                int offset = fault.equals("metadata-version") ? 4
                    : fault.equals("metadata-flags") ? 104
                    : fault.equals("metadata-iv") ? 12
                    : fault.equals("metadata-sequence") ? 8
                    : fault.equals("metadata-last-size") ? 32
                    : fault.equals("metadata-last-crc") ? 36 : 28;
                byte[] changed = originalCrc.clone();
                changed[offset] ^= fault.equals("metadata-flags") ? 1 : 0x40;
                Files.write(crc.toPath(), changed);
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
                preflight.put("portfolioMatches", payload.equals(pre.decodeString("portfolio")));
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
            String rejection = "none";
            boolean writableOpened = false;
            MMKV reopened = null;
            try {
                if (mode.equals("guarded") || mode.equals("format-guarded")) {
                    // Candidate only: never call native open on missing/truncated files.
                    if (!data.isFile() || !crc.isFile()
                            || data.length() < MMKV.pageSize() || crc.length() < MMKV.pageSize()) {
                        rejection = "file-pair";
                    } else {
                        preflight.put("dataHeaderSize", Integer.toUnsignedLong(ByteBuffer.wrap(beforeData).order(ByteOrder.LITTLE_ENDIAN).getInt(0)));
                        preflight.put("metadataSize", Integer.toUnsignedLong(ByteBuffer.wrap(beforeCrc).order(ByteOrder.LITTLE_ENDIAN).getInt(28)));
                        preflight.put("metadataVersion", Integer.toUnsignedLong(ByteBuffer.wrap(beforeCrc).order(ByteOrder.LITTLE_ENDIAN).getInt(4)));
                        if (mode.equals("guarded")) {
                            boolean valid = MMKV.isFileValid(id, root);
                            preflight.put("nativeFileValid", valid);
                            if (!valid) rejection = "native-validation";
                        } else {
                            rejection = FormatGuard.reject(beforeData, beforeCrc, MMKV.pageSize());
                            preflight.put("formatValid", rejection.equals("none"));
                        }
                    }
                    // One owner only in this probe. This is not an atomic OS-level open lock.
                    if (rejection.equals("none") && (!Arrays.equals(beforeData, bytes(data))
                            || !Arrays.equals(beforeCrc, bytes(crc)))) {
                        rejection = "files-changed-before-open";
                    }
                    if (rejection.equals("none")) {
                        if (suppliedKey == null || suppliedKey.isEmpty()) {
                            rejection = "missing-key";
                        } else {
                            MMKV pre = open(id, suppliedKey, true);
                            try {
                                preflight.put("sentinelMatches", MARKER.equals(pre.decodeString("sentinel")));
                                preflight.put("portfolioMatches", payload.equals(pre.decodeString("portfolio")));
                            } finally {
                                pre.close();
                            }
                            preflight.put("dataUnchanged", Arrays.equals(beforeData, bytes(data)));
                            preflight.put("crcUnchanged", Arrays.equals(beforeCrc, bytes(crc)));
                            if (!preflight.getBoolean("sentinelMatches") || !preflight.getBoolean("portfolioMatches")) {
                                rejection = "record-validation";
                            } else if (!preflight.getBoolean("dataUnchanged") || !preflight.getBoolean("crcUnchanged")) {
                                rejection = "preflight-mutated-files";
                            }
                        }
                    }
                }
                if (rejection.equals("none")) {
                    reopened = open(id, suppliedKey, readOnly);
                    writableOpened = !readOnly;
                    sentinelMatches = MARKER.equals(reopened.decodeString("sentinel"));
                    portfolioMatches = payload.equals(reopened.decodeString("portfolio"));
                }
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
            if (mode.equals("lifecycle") || mode.endsWith("guarded")) result.put("preflight", preflight);
            if (mode.endsWith("guarded")) {
                result.put("rejection", rejection);
                result.put("writableOpened", writableOpened);
            }
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
            if (mode.endsWith("guarded") && writableOpened
                    && sentinelMatches && portfolioMatches && Arrays.equals(beforeData, afterData)
                    && Arrays.equals(beforeCrc, afterCrc)) {
                // A separate positive-control phase, after preservation hashes are captured.
                MMKV writer = open(id, key, false);
                boolean wrote = writer.encode("followup", MARKER + "_FOLLOWUP");
                writer.sync();
                writer.close();
                String afterWriteGuard = FormatGuard.reject(bytes(data), bytes(crc), MMKV.pageSize());
                boolean readBack = false;
                if (afterWriteGuard.equals("none")) {
                    MMKV reader = open(id, key, true);
                    readBack = (MARKER + "_FOLLOWUP").equals(reader.decodeString("followup"))
                        && MARKER.equals(reader.decodeString("sentinel"))
                        && payload.equals(reader.decodeString("portfolio"));
                    reader.close();
                }
                result.put("writeRoundTrip", wrote && readBack);
                result.put("afterWriteGuard", afterWriteGuard);
            }
            output.putString("stream", "\n" + result + "\n");
            finish(-1, output);
        } catch (Exception error) {
            // No secrets or exception messages in output.
            output.putString("stream", "PROBE_ERROR " + error.getClass().getSimpleName());
            finish(1, output);
        }
    }
}
