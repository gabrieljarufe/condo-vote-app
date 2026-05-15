package com.condovote.auth;

import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@Component
public class SupabaseAdminGatewayImpl implements SupabaseAdminGateway {

  private final RestClient restClient;
  private final String serviceRoleKey;

  @Autowired
  public SupabaseAdminGatewayImpl(
      @Value("${supabase.url}") String supabaseUrl,
      @Value("${supabase.service-role-key:}") String serviceRoleKey) {
    this(RestClient.builder().baseUrl(supabaseUrl).build(), serviceRoleKey);
  }

  // visível para testes — permite injetar RestClient com MockRestServiceServer
  SupabaseAdminGatewayImpl(RestClient restClient, String serviceRoleKey) {
    this.restClient = restClient;
    this.serviceRoleKey = serviceRoleKey;
  }

  @Override
  public UUID createUser(String email, String password) {
    if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
      throw new SupabaseAdminException(
          "SUPABASE_SERVICE_ROLE_KEY não configurado — obtenha via 'supabase status' "
              + "(local) ou Coolify env vars (prod). Sem ela, /api/public/register/complete não funciona.");
    }
    Map<String, Object> body = Map.of("email", email, "password", password, "email_confirm", true);

    try {
      Map<String, Object> response =
          restClient
              .post()
              .uri("/auth/v1/admin/users")
              .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
              .header("apikey", serviceRoleKey)
              .contentType(MediaType.APPLICATION_JSON)
              .body(body)
              .retrieve()
              .body(
                  new org.springframework.core.ParameterizedTypeReference<
                      Map<String, Object>>() {});

      if (response == null || response.get("id") == null) {
        throw new SupabaseAdminException("Resposta inesperada do Supabase Admin: " + response);
      }
      return UUID.fromString(response.get("id").toString());
    } catch (RestClientResponseException e) {
      throw new SupabaseAdminException(
          "Supabase Admin API retornou " + e.getStatusCode() + ": " + e.getResponseBodyAsString(),
          e);
    } catch (IllegalArgumentException e) {
      throw new SupabaseAdminException("ID retornado não é UUID válido", e);
    }
  }
}
