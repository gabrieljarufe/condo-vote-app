package com.condovote.shared.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.boot.json.JsonWriter;
import org.springframework.boot.logging.structured.StructuredLoggingJsonMembersCustomizer;

public class SensitiveDataMaskingCustomizer
    implements StructuredLoggingJsonMembersCustomizer<ILoggingEvent> {

  private static final List<String> SENSITIVE_KEY_FRAGMENTS =
      List.of("cpf", "password", "token", "authorization", "secret", "key");

  private static final Pattern CPF_FORMATTED =
      Pattern.compile("\\b\\d{3}\\.\\d{3}\\.\\d{3}-(\\d{2})\\b");

  private static final Pattern BEARER_TOKEN = Pattern.compile("Bearer\\s+[A-Za-z0-9._-]+");

  private static final Pattern JWT_TOKEN =
      Pattern.compile("\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\b");

  private static final Pattern SUPABASE_KEY =
      Pattern.compile("\\b(sb|sk|pk)_[A-Za-z0-9_-]{20,}\\b");

  @Override
  public void customize(JsonWriter.Members<ILoggingEvent> members) {
    JsonWriter.ValueProcessor<String> processor =
        (path, value) -> {
          if (value == null) {
            return null;
          }
          String pathStr = path.toString();
          if (isSensitivePath(pathStr)) {
            return "[REDACTED]";
          }
          if ("message".equals(pathStr)) {
            return mask(value);
          }
          return value;
        };
    members.applyingValueProcessor(processor);
  }

  private static boolean isSensitivePath(String path) {
    String lower = path.toLowerCase();
    for (String fragment : SENSITIVE_KEY_FRAGMENTS) {
      if (lower.contains(fragment)) {
        return true;
      }
    }
    return false;
  }

  static String mask(String value) {
    if (value == null) {
      return null;
    }
    value = CPF_FORMATTED.matcher(value).replaceAll("***.***.***-$1");
    value = BEARER_TOKEN.matcher(value).replaceAll("Bearer ***");
    value = JWT_TOKEN.matcher(value).replaceAll("eyJ***.***.***.***");
    value =
        SUPABASE_KEY
            .matcher(value)
            .replaceAll(
                mr -> {
                  String group = mr.group(1);
                  String full = mr.group(0);
                  String prefix = full.substring(0, Math.min(6, full.length()));
                  return prefix + "***";
                });
    return value;
  }

  static String processValue(String path, String value) {
    if (value == null) {
      return null;
    }
    if (isSensitivePath(path)) {
      return "[REDACTED]";
    }
    if ("message".equals(path)) {
      return mask(value);
    }
    return value;
  }
}
