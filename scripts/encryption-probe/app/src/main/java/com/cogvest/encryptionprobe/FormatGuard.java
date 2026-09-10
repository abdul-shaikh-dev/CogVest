package com.cogvest.encryptionprobe;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.zip.CRC32;

/** Experimental v2.4.0/version-4 validator. Not a production storage API. */
final class FormatGuard {
    private FormatGuard() {}

    static String reject(byte[] data, byte[] metadata, int pageSize) {
        // The 1 MiB limit is a probe bound, not an approved CogVest storage limit.
        if (data == null || metadata == null || data.length < pageSize
                || metadata.length < pageSize || data.length > 1024 * 1024
                || data.length % pageSize != 0 || metadata.length != pageSize || metadata.length < 112) {
            return "file-bounds";
        }
        ByteBuffer meta = ByteBuffer.wrap(metadata).order(ByteOrder.LITTLE_ENDIAN);
        if (meta.getInt(4) != 4 || meta.getLong(104) != 0) return "unsupported-metadata";
        long size = Integer.toUnsignedLong(meta.getInt(28));
        if (size == 0 || size > data.length - 4) return "payload-size";
        CRC32 crc = new CRC32();
        crc.update(data, 4, (int) size);
        if (crc.getValue() != Integer.toUnsignedLong(meta.getInt(0))) return "payload-crc";
        return "none";
    }
}
