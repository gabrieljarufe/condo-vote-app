package com.condovote.shared.exception;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;

class GlobalExceptionHandlerTest {

  MockMvc mvc;

  @BeforeEach
  void setUp() {
    mvc =
        MockMvcBuilders.standaloneSetup(new TestController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  void validationError_returns400WithFieldDetails() throws Exception {
    mvc.perform(post("/test/validation").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.details[0].field").value("name"));
  }

  @Test
  void dataIntegrityViolation_returns409() throws Exception {
    mvc.perform(get("/test/conflict"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("CONFLICT"));
  }

  @Test
  void forbiddenException_returns403() throws Exception {
    mvc.perform(get("/test/forbidden"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"))
        .andExpect(jsonPath("$.message").value("acesso negado"));
  }

  @Test
  void notFoundException_returns404() throws Exception {
    mvc.perform(get("/test/not-found"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("recurso não encontrado"));
  }

  @Test
  void unexpectedException_returns500WithoutStacktrace() throws Exception {
    mvc.perform(get("/test/error"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
        .andExpect(jsonPath("$.message").value("Erro interno do servidor"))
        .andExpect(jsonPath("$.stackTrace").doesNotExist());
  }

  @Test
  void allResponses_containTimestamp() throws Exception {
    mvc.perform(get("/test/forbidden")).andExpect(jsonPath("$.timestamp").isNotEmpty());
  }

  // --- inline test controller ---

  record NameRequest(@NotBlank String name) {}

  @RestController
  @RequestMapping("/test")
  static class TestController {

    @PostMapping("/validation")
    void validation(@Valid @RequestBody NameRequest req) {}

    @GetMapping("/conflict")
    void conflict() {
      throw new DataIntegrityViolationException("uk_violation");
    }

    @GetMapping("/forbidden")
    void forbidden() {
      throw new ForbiddenException("acesso negado");
    }

    @GetMapping("/not-found")
    void notFound() {
      throw new NotFoundException("recurso não encontrado");
    }

    @GetMapping("/error")
    void error() {
      throw new RuntimeException("boom");
    }
  }
}
