package com.condovote.apartment;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.condovote.AbstractIntegrationTest;
import com.condovote.shared.UuidV7;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@Tag("integration")
@SpringBootTest
@Transactional
class ApartmentControllerIT extends AbstractIntegrationTest {

  @Autowired WebApplicationContext context;

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
  }

  // --- POST /api/condominiums/{id}/apartments ---

  @Test
  void create_semAutorizacao_retorna401() throws Exception {
    UUID condoId = insertCondo("Condo 401");
    mvc.perform(
            post("/api/condominiums/{id}/apartments", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"unitNumber":"101","block":"A"}
                    """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void create_adminHappyPath_retorna201() throws Exception {
    UUID condoId = insertCondo("Condo H2");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);

    mvc.perform(
            post("/api/condominiums/{id}/apartments", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"unitNumber":"101","block":"A"}
                    """)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").isNotEmpty())
        .andExpect(jsonPath("$.unitNumber").value("101"))
        .andExpect(jsonPath("$.block").value("A"))
        .andExpect(jsonPath("$.isDelinquent").value(false));
  }

  @Test
  void create_unidadeDuplicada_retorna409() throws Exception {
    UUID condoId = insertCondo("Condo Dup");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    insertApartment(condoId, "101");

    mvc.perform(
            post("/api/condominiums/{id}/apartments", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"unitNumber":"101"}
                    """)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isConflict());
  }

  @Test
  void create_naoAdmin_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo 403");
    UUID adminId = UuidV7.generate();
    UUID residentId = UuidV7.generate();
    UUID aptId = insertApartment(condoId, "100");
    insertAdmin(condoId, adminId);
    insertResident(condoId, aptId, residentId, "OWNER");

    mvc.perform(
            post("/api/condominiums/{id}/apartments", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"unitNumber":"201","block":"B"}
                    """)
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isForbidden());
  }

  // --- GET /api/condominiums/{id}/apartments ---

  @Test
  void list_adminComApartamentos_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo List");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    insertApartment(condoId, "101");
    insertApartment(condoId, "102");

    mvc.perform(
            get("/api/condominiums/{id}/apartments", condoId)
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$", hasSize(2)));
  }

  @Test
  void list_naoAdmin_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo List 403");
    UUID adminId = UuidV7.generate();
    UUID residentId = UuidV7.generate();
    UUID aptId = insertApartment(condoId, "100");
    insertAdmin(condoId, adminId);
    insertResident(condoId, aptId, residentId, "OWNER");

    mvc.perform(
            get("/api/condominiums/{id}/apartments", condoId)
                .accept(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isForbidden());
  }

  // --- PATCH /api/apartments/{id}/delinquent ---

  @Test
  void setDelinquent_adminToggle_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Toggle");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");

    mvc.perform(
            patch("/api/apartments/{id}/delinquent", aptId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"isDelinquent":true}
                    """)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.isDelinquent").value(true));
  }

  @Test
  void setDelinquent_idempotente_retorna200() throws Exception {
    UUID condoId = insertCondo("Condo Idem");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    UUID aptId = insertApartment(condoId, "101");

    mvc.perform(
            patch("/api/apartments/{id}/delinquent", aptId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"isDelinquent":false}
                    """)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.isDelinquent").value(false));
  }

  @Test
  void setDelinquent_naoAdmin_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo 403 Delinq");
    UUID adminId = UuidV7.generate();
    UUID residentId = UuidV7.generate();
    UUID aptId = insertApartment(condoId, "101");
    insertAdmin(condoId, adminId);
    insertResident(condoId, aptId, residentId, "OWNER");

    mvc.perform(
            patch("/api/apartments/{id}/delinquent", aptId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"isDelinquent":true}
                    """)
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isForbidden());
  }
}
