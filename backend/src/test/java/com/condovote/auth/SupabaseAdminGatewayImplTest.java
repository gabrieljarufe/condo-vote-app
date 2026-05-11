package com.condovote.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class SupabaseAdminGatewayImplTest {

  private static final String BASE = "https://example.supabase.co";
  private static final String KEY = "service-role-key-xxx";

  private MockRestServiceServer server;
  private SupabaseAdminGatewayImpl gateway;

  @BeforeEach
  void setUp() {
    RestClient.Builder builder = RestClient.builder().baseUrl(BASE);
    server = MockRestServiceServer.bindTo(builder).build();
    gateway = new SupabaseAdminGatewayImpl(builder.build(), KEY);
  }

  @Test
  void createUser_postsAdminEndpointAndReturnsId() {
    UUID expectedId = UUID.randomUUID();
    server
        .expect(requestTo(BASE + "/auth/v1/admin/users"))
        .andExpect(method(HttpMethod.POST))
        .andExpect(header("Authorization", "Bearer " + KEY))
        .andExpect(header("apikey", KEY))
        .andExpect(jsonPath("$.email").value("morador@condovote.com"))
        .andExpect(jsonPath("$.password").value("s3nh4-segura"))
        .andExpect(jsonPath("$.email_confirm").value(true))
        .andRespond(withSuccess("{\"id\":\"" + expectedId + "\"}", MediaType.APPLICATION_JSON));

    UUID actual = gateway.createUser("morador@condovote.com", "s3nh4-segura");

    assertThat(actual).isEqualTo(expectedId);
    server.verify();
  }

  @Test
  void createUser_wrapsHttpErrorsInSupabaseAdminException() {
    server
        .expect(requestTo(BASE + "/auth/v1/admin/users"))
        .andRespond(withServerError().body("Supabase down").contentType(MediaType.TEXT_PLAIN));

    assertThatThrownBy(() -> gateway.createUser("x@y.com", "pwd"))
        .isInstanceOf(SupabaseAdminException.class)
        .hasMessageContaining("500");
  }

  @Test
  void createUser_throwsWhenIdMissing() {
    server
        .expect(requestTo(BASE + "/auth/v1/admin/users"))
        .andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

    assertThatThrownBy(() -> gateway.createUser("x@y.com", "pwd"))
        .isInstanceOf(SupabaseAdminException.class)
        .hasMessageContaining("Resposta inesperada");
  }
}
