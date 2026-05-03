package com.condovote.shared;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.assertThat;

class UuidV7Test {

    @BeforeEach
    void resetState() throws Exception {
        setStaticField("lastTimestampMs", 0L);
        setStaticField("counter", 0L);
    }

    @Test
    void version_is_7() {
        UUID uuid = UuidV7.generate();
        assertThat((uuid.getMostSignificantBits() >> 12) & 0xFL).isEqualTo(7L);
    }

    @Test
    void variant_is_rfc4122() {
        UUID uuid = UuidV7.generate();
        assertThat((uuid.getLeastSignificantBits() >>> 62) & 0x3L).isEqualTo(2L);
    }

    @Test
    void sequential_uuids_are_monotonically_ordered() {
        List<UUID> uuids = new ArrayList<>(1000);
        for (int i = 0; i < 1000; i++) uuids.add(UuidV7.generate());
        for (int i = 0; i < uuids.size() - 1; i++) {
            assertThat(uuids.get(i).compareTo(uuids.get(i + 1)))
                    .as("uuid[%d] deve ser menor que uuid[%d]", i, i + 1)
                    .isNegative();
        }
    }

    @Test
    void counter_overflow_advances_timestamp() throws Exception {
        long fixedTs = System.currentTimeMillis();
        setStaticField("lastTimestampMs", fixedTs);
        setStaticField("counter", 0xFFFL); // COUNTER_MAX

        // Próxima chamada com o mesmo ms vai incrementar para 0x1000 > COUNTER_MAX → overflow
        UUID uuid = UuidV7.generate();

        long ts = uuid.getMostSignificantBits() >>> 16;
        assertThat(ts).isGreaterThanOrEqualTo(fixedTs + 1);

        long counter = uuid.getMostSignificantBits() & 0xFFFL;
        assertThat(counter).isLessThanOrEqualTo(0x7FFL); // reiniciou em 0..2047
    }

    @Test
    void clock_regression_does_not_decrease_timestamp() throws Exception {
        long futureTs = System.currentTimeMillis() + 5000;
        setStaticField("lastTimestampMs", futureTs);
        setStaticField("counter", 0L);

        UUID uuid = UuidV7.generate();

        long ts = uuid.getMostSignificantBits() >>> 16;
        assertThat(ts).isGreaterThanOrEqualTo(futureTs);
    }

    @Test
    void concurrent_generation_produces_unique_uuids() throws Exception {
        int threads = 8;
        int perThread = 1000;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        List<Future<List<UUID>>> futures = new ArrayList<>();

        for (int t = 0; t < threads; t++) {
            futures.add(pool.submit(() -> {
                List<UUID> list = new ArrayList<>(perThread);
                for (int i = 0; i < perThread; i++) list.add(UuidV7.generate());
                return list;
            }));
        }

        Set<UUID> all = new HashSet<>();
        for (Future<List<UUID>> f : futures) all.addAll(f.get());
        pool.shutdown();

        assertThat(all).hasSize(threads * perThread);
    }

    private static void setStaticField(String fieldName, long value) throws Exception {
        Field field = UuidV7.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(null, value);
    }
}
