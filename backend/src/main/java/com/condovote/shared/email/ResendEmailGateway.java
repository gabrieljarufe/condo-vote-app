package com.condovote.shared.email;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "resend")
public class ResendEmailGateway implements EmailGateway {

  private final WebClient webClient;
  private final String from;

  public ResendEmailGateway(
      WebClient.Builder webClientBuilder,
      @Value("${app.email.resend.api-key}") String apiKey,
      @Value("${app.email.resend.api-url}") String apiUrl,
      @Value("${app.email.from}") String from) {
    this.webClient =
        webClientBuilder
            .baseUrl(apiUrl)
            .defaultHeader("Authorization", "Bearer " + apiKey)
            .defaultHeader("Content-Type", "application/json")
            .build();
    this.from = from;
  }

  @Override
  public void send(EmailMessage msg) throws EmailDeliveryException {
    Map<String, Object> payload = new HashMap<>();
    payload.put("from", from);
    payload.put("to", List.of(msg.to()));
    payload.put("subject", msg.subject());
    payload.put("html", msg.htmlBody());
    if (msg.textBody() != null && !msg.textBody().isBlank()) {
      payload.put("text", msg.textBody());
    }

    try {
      webClient
          .post()
          .bodyValue(payload)
          .retrieve()
          .onStatus(
              HttpStatusCode::is4xxClientError,
              resp ->
                  resp.bodyToMono(String.class)
                      .flatMap(
                          body ->
                              Mono.error(
                                  new EmailDeliveryException(
                                      "Resend 4xx: " + body, isHardBounceFromBody(body)))))
          .onStatus(
              HttpStatusCode::is5xxServerError,
              resp ->
                  resp.bodyToMono(String.class)
                      .flatMap(
                          body ->
                              Mono.error(new EmailDeliveryException("Resend 5xx: " + body, false))))
          .toBodilessEntity()
          .block();
    } catch (RuntimeException e) {
      Throwable cause = e.getCause() != null ? e.getCause() : e;
      if (cause instanceof EmailDeliveryException ede) {
        throw ede;
      }
      throw new EmailDeliveryException(
          "Resend request failed: " + cause.getMessage(), cause, false);
    }
  }

  private boolean isHardBounceFromBody(String body) {
    if (body == null) {
      return false;
    }
    return body.contains("invalid_email") || body.contains("validation_failed");
  }
}
