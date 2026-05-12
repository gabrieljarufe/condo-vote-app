package com.condovote.apartment;

import com.condovote.apartment.dto.ApartmentResponse;
import com.condovote.apartment.dto.BatchCreateApartmentRequest;
import com.condovote.apartment.dto.BatchCreateApartmentResponse;
import com.condovote.apartment.dto.CreateApartmentRequest;
import com.condovote.apartment.dto.SetDelinquentRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ApartmentController {

  private final ApartmentService service;

  public ApartmentController(ApartmentService service) {
    this.service = service;
  }

  @PostMapping("/condominiums/{condominiumId}/apartments")
  @ResponseStatus(HttpStatus.CREATED)
  public ApartmentResponse create(
      @PathVariable UUID condominiumId, @Valid @RequestBody CreateApartmentRequest request) {
    return service.create(condominiumId, request);
  }

  @PostMapping("/condominiums/{condominiumId}/apartments/batch")
  @ResponseStatus(HttpStatus.OK)
  public BatchCreateApartmentResponse createBatch(
      @PathVariable UUID condominiumId, @Valid @RequestBody BatchCreateApartmentRequest request) {
    return service.createBatch(condominiumId, request.items());
  }

  @GetMapping("/condominiums/{condominiumId}/apartments")
  public List<ApartmentResponse> list(@PathVariable UUID condominiumId) {
    return service.listByCondominium(condominiumId);
  }

  @PatchMapping("/apartments/{id}/delinquent")
  public ApartmentResponse setDelinquent(
      @PathVariable UUID id, @RequestBody SetDelinquentRequest request) {
    return service.setDelinquent(id, request.isDelinquent());
  }
}
