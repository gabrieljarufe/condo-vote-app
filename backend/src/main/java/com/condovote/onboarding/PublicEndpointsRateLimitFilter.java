package com.condovote.onboarding;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rate-limit por IP nos endpoints públicos de onboarding ({@code /api/public/**}). Backend rodando
 * single-instance (Coolify) — bucket in-memory é suficiente para o piloto. Quando virarmos
 * multi-instância, trocar por bucket compartilhado (Redis).
 */
@Component
public class PublicEndpointsRateLimitFilter extends OncePerRequestFilter {

  private final ConcurrentMap<String, Bucket> buckets = new ConcurrentHashMap<>();
  private final int requestsPerMinute;

  public PublicEndpointsRateLimitFilter(
      @Value("${app.onboarding.rate-limit.requests-per-minute:20}") int requestsPerMinute) {
    this.requestsPerMinute = requestsPerMinute;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !request.getRequestURI().startsWith("/api/public/");
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    Bucket bucket = buckets.computeIfAbsent(clientIp(request), ip -> newBucket());
    if (bucket.tryConsume(1)) {
      chain.doFilter(request, response);
      return;
    }
    response.setStatus(429);
    response.setHeader("Retry-After", "60");
    response.setContentType("application/json");
    response.getWriter().write("{\"code\":\"RATE_LIMITED\",\"message\":\"Muitas requisições\"}");
  }

  private Bucket newBucket() {
    Bandwidth limit =
        Bandwidth.builder()
            .capacity(requestsPerMinute)
            .refillGreedy(requestsPerMinute, Duration.ofMinutes(1))
            .build();
    return Bucket.builder().addLimit(limit).build();
  }

  private static String clientIp(HttpServletRequest req) {
    String xff = req.getHeader("X-Forwarded-For");
    if (xff != null && !xff.isBlank()) {
      int comma = xff.indexOf(',');
      return (comma > 0 ? xff.substring(0, comma) : xff).trim();
    }
    return req.getRemoteAddr();
  }
}
