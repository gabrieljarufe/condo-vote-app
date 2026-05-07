package com.condovote.condominium;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class CondominiumControllerTest {

  MockMvc mvc;
  CondominiumService service;

  @BeforeEach
  void setUp() {
    service = Mockito.mock(CondominiumService.class);
    mvc = MockMvcBuilders.standaloneSetup(new CondominiumController(service)).build();
  }

  @Test
  void listReturnsCondominiumsFromService() throws Exception {
    UUID id = UUID.fromString("019dd4f8-57fa-77b1-ace2-c9f6a3d9811e");
    when(service.listForCurrentUser())
        .thenReturn(List.of(new CondominiumSummary(id, "Condo Teste", UserRoleInCondo.ADMIN)));

    mvc.perform(get("/api/me/condominiums").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(id.toString()))
        .andExpect(jsonPath("$[0].name").value("Condo Teste"))
        .andExpect(jsonPath("$[0].role").value("ADMIN"));
  }

  @Test
  void listReturnsEmptyArrayWhenNoCondominiums() throws Exception {
    when(service.listForCurrentUser()).thenReturn(List.of());

    mvc.perform(get("/api/me/condominiums").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(content().json("[]"));
  }

  @Test
  void listReturnsMultipleCondominiums() throws Exception {
    when(service.listForCurrentUser())
        .thenReturn(
            List.of(
                new CondominiumSummary(
                    UuidV7Reference.randomUUID(), "Condo A", UserRoleInCondo.OWNER),
                new CondominiumSummary(
                    UuidV7Reference.randomUUID(), "Condo B", UserRoleInCondo.TENANT)));

    mvc.perform(get("/api/me/condominiums").accept(MediaType.APPLICATION_JSON))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].role").value("OWNER"))
        .andExpect(jsonPath("$[1].role").value("TENANT"));
  }

  // evita dependência de UuidV7 (gerador com estado) nos testes de unidade
  private static class UuidV7Reference {
    static UUID randomUUID() {
      return UUID.randomUUID();
    }
  }
}
