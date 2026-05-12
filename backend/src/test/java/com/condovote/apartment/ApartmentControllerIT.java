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

  // --- POST /api/condominiums/{id}/apartments/batch ---

  @Test
  void createBatch_semAutorizacao_retorna401() throws Exception {
    UUID condoId = insertCondo("Condo Batch 401");
    mvc.perform(
            post("/api/condominiums/{id}/apartments/batch", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"items":[{"unitNumber":"101","block":"A"}]}
                    """))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void createBatch_adminHappyPath_retorna200ComCreated() throws Exception {
    UUID condoId = insertCondo("Condo Batch Happy");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);

    mvc.perform(
            post("/api/condominiums/{id}/apartments/batch", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"items":[{"unitNumber":"101","block":"A"},{"unitNumber":"102","block":"A"}]}
                    """)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.created", hasSize(2)))
        .andExpect(jsonPath("$.skipped", hasSize(0)));
  }

  @Test
  void createBatch_idempotente_segundaChamadaRetornaSkipped() throws Exception {
    UUID condoId = insertCondo("Condo Batch Idem");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    insertApartment(condoId, "101");

    mvc.perform(
            post("/api/condominiums/{id}/apartments/batch", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"items":[{"unitNumber":"101"},{"unitNumber":"102"}]}
                    """)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.created", hasSize(1)))
        .andExpect(jsonPath("$.skipped", hasSize(1)))
        .andExpect(jsonPath("$.skipped[0].unitNumber").value("101"))
        .andExpect(jsonPath("$.skipped[0].reason").value("DUPLICATE"));
  }

  @Test
  void createBatch_naoAdmin_retorna403() throws Exception {
    UUID condoId = insertCondo("Condo Batch 403");
    UUID adminId = UuidV7.generate();
    UUID residentId = UuidV7.generate();
    UUID aptId = insertApartment(condoId, "100");
    insertAdmin(condoId, adminId);
    insertResident(condoId, aptId, residentId, "OWNER");

    mvc.perform(
            post("/api/condominiums/{id}/apartments/batch", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"items":[{"unitNumber":"201","block":"B"}]}
                    """)
                .with(jwt().jwt(b -> b.subject(residentId.toString()))))
        .andExpect(status().isForbidden());
  }

  @Test
  void createBatch_listaVazia_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Batch Empty");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);

    mvc.perform(
            post("/api/condominiums/{id}/apartments/batch", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"items":[]}
                    """)
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createBatch_itemInvalido_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Batch Invalid");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);
    String longUnit = "A".repeat(25);

    mvc.perform(
            post("/api/condominiums/{id}/apartments/batch", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content(
                    """
                    {"items":[{"unitNumber":"%s","block":"A"}]}
                    """
                        .formatted(longUnit))
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isBadRequest());
  }

  @Test
  void createBatch_acimaDe500Itens_retorna400() throws Exception {
    UUID condoId = insertCondo("Condo Batch Over500");
    UUID userId = UuidV7.generate();
    insertAdmin(condoId, userId);

    StringBuilder items = new StringBuilder("[");
    for (int i = 1; i <= 501; i++) {
      if (i > 1) items.append(",");
      items.append("{\"unitNumber\":\"").append(i).append("\"}");
    }
    items.append("]");

    mvc.perform(
            post("/api/condominiums/{id}/apartments/batch", condoId)
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Tenant-Id", condoId.toString())
                .content("{\"items\":" + items + "}")
                .with(jwt().jwt(b -> b.subject(userId.toString()))))
        .andExpect(status().isBadRequest());
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
