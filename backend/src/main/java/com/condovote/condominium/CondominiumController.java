package com.condovote.condominium;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/condominiums")
public class CondominiumController {

  private final CondominiumService service;

  public CondominiumController(CondominiumService service) {
    this.service = service;
  }

  @GetMapping
  public List<CondominiumSummary> list() {
    return service.listForCurrentUser();
  }
}
