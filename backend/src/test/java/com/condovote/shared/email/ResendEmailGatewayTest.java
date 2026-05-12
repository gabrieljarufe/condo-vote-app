package com.condovote.shared.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

class ResendEmailGatewayTest {

  private MockWebServer mockWebServer;
  private ResendEmailGateway gateway;

  @BeforeEach
  void setUp() throws Exception {
    mockWebServer = new MockWebServer();
    mockWebServer.start();

    String baseUrl = mockWebServer.url("/").toString();
    gateway =
        new ResendEmailGateway(
            WebClient.builder(), "test-api-key", baseUrl, "no-reply@condovote.app");
  }

  @AfterEach
  void tearDown() throws Exception {
    mockWebServer.shutdown();
  }

  @Test
  void send_validMessage_postsToResendApi() throws Exception {
    mockWebServer.enqueue(new MockResponse().setResponseCode(200));

    var msg = new EmailMessage("morador@example.com", "Convite ao condomínio", "<p>Olá</p>", null);
    gateway.send(msg);

    RecordedRequest request = mockWebServer.takeRequest();
    assertThat(request.getMethod()).isEqualTo("POST");
    assertThat(request.getHeader("Authorization")).isEqualTo("Bearer test-api-key");
    assertThat(request.getHeader("Content-Type")).startsWith("application/json");

    String body = request.getBody().readUtf8();
    assertThat(body).contains("\"from\"");
    assertThat(body).contains("no-reply@condovote.app");
    assertThat(body).contains("morador@example.com");
    assertThat(body).contains("Convite ao condom");
    assertThat(body).contains("<p>Olá</p>");
  }

  @Test
  void send_resend4xx_throwsHardBounce() {
    mockWebServer.enqueue(
        new MockResponse()
            .setResponseCode(422)
            .setBody("{\"message\":\"invalid_email_address\",\"name\":\"validation_error\"}")
            .addHeader("Content-Type", "application/json"));

    var msg = new EmailMessage("bad@invalid", "Teste", "<p>Teste</p>", null);

    assertThatThrownBy(() -> gateway.send(msg))
        .isInstanceOf(EmailDeliveryException.class)
        .satisfies(ex -> assertThat(((EmailDeliveryException) ex).isHardBounce()).isTrue());
  }

  @Test
  void send_resend5xx_throwsSoftError() {
    mockWebServer.enqueue(new MockResponse().setResponseCode(503).setBody("Service Unavailable"));

    var msg = new EmailMessage("morador@example.com", "Teste", "<p>Teste</p>", null);

    assertThatThrownBy(() -> gateway.send(msg))
        .isInstanceOf(EmailDeliveryException.class)
        .satisfies(ex -> assertThat(((EmailDeliveryException) ex).isHardBounce()).isFalse());
  }

  @Test
  void send_networkError_throws() throws Exception {
    mockWebServer.shutdown();

    var msg = new EmailMessage("morador@example.com", "Teste", "<p>Teste</p>", null);

    assertThatThrownBy(() -> gateway.send(msg)).isInstanceOf(EmailDeliveryException.class);
  }
}
