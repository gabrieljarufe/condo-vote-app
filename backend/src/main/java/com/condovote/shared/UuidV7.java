package com.condovote.shared;

import java.security.SecureRandom;
import java.util.UUID;

/**
 * Gera UUID v7 (RFC 9562) com garantia de monotonicidade.
 * <p>
 * Estrutura (128 bits):
 * 48 bits  unix_ts_ms       timestamp em milissegundos
 * 4 bits  version = 7
 * 12 bits  counter          RFC 9562 §6.2 Método 1 (contador dedicado)
 * 2 bits  variant = 10     RFC 4122
 * 62 bits  rand             entropia criptográfica
 * <p>
 * Monotonicidade (RFC 9562 §6.2):
 * - UUIDs gerados em ordem temporal são ordenados lexicograficamente.
 * - Dentro do mesmo ms: counter incrementa.
 * - Se o relógio retroceder: lastTimestampMs nunca decresce (estável).
 * - Se o counter estourar (4096 UUIDs/ms): avança timestamp em 1ms.
 * <p>
 * Thread-safe via synchronized.
 */
public final class UuidV7 {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final long COUNTER_MAX = 0xFFFL; // 12 bits = 4095

    private static long lastTimestampMs = 0L;
    private static long counter = 0L;

    private UuidV7() {
    }

    public static UUID generate() {
        long timestamp;
        long c;

        synchronized (UuidV7.class) {
            long now = System.currentTimeMillis();

            if (now > lastTimestampMs) {
                // Novo ms — reseta counter com valor baixo para dar margem de crescimento
                lastTimestampMs = now;
                counter = RANDOM.nextLong() & (COUNTER_MAX >>> 1); // 0..2047
            } else {
                // Mesmo ms (ou clock backward) — incrementa
                counter++;
                if (counter > COUNTER_MAX) {
                    // Counter estourou: avança timestamp lógico, reseta
                    lastTimestampMs++;
                    counter = RANDOM.nextLong() & (COUNTER_MAX >>> 1);
                }
            }

            timestamp = lastTimestampMs;
            c = counter;
        }

        long randB = RANDOM.nextLong() & 0x3FFFFFFFFFFFFFFFL; // 62 bits

        // MSB: [48 timestamp][4 version=7][12 counter]
        long msb = (timestamp << 16) | (0x7L << 12) | c;

        // LSB: [2 variant=10][62 random]
        long lsb = (0b10L << 62) | randB;

        return new UUID(msb, lsb);
    }
}
