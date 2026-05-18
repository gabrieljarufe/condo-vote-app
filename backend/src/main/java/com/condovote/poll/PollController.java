package com.condovote.poll;

import com.condovote.poll.dto.CancelPollRequest;
import com.condovote.poll.dto.CreatePollRequest;
import com.condovote.poll.dto.PollDetailResponse;
import com.condovote.poll.dto.PollResponse;
import com.condovote.poll.dto.UpdatePollRequest;
import com.condovote.shared.web.PageResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Expõe os endpoints REST do ciclo de vida de votações. */
@RestController
@RequestMapping("/api")
public class PollController {

  private final PollService service;

  public PollController(PollService service) {
    this.service = service;
  }

  @PostMapping("/condominiums/{condoId}/polls")
  @ResponseStatus(HttpStatus.CREATED)
  public PollResponse create(
      @PathVariable UUID condoId, @Valid @RequestBody CreatePollRequest request) {
    return service.createDraft(condoId, request);
  }

  @PutMapping("/polls/{id}")
  public PollResponse update(@PathVariable UUID id, @Valid @RequestBody UpdatePollRequest request) {
    return service.updateDraft(id, request);
  }

  @PostMapping("/polls/{id}/publish")
  public PollResponse publish(@PathVariable UUID id) {
    return service.publish(id);
  }

  @PostMapping("/polls/{id}/open")
  public PollResponse open(@PathVariable UUID id) {
    return service.openManually(id);
  }

  @PostMapping("/polls/{id}/cancel")
  public PollResponse cancel(@PathVariable UUID id, @Valid @RequestBody CancelPollRequest request) {
    return service.cancel(id, request);
  }

  @PostMapping("/polls/{id}/close")
  public PollResponse close(@PathVariable UUID id) {
    return service.closeManually(id);
  }

  @GetMapping("/condominiums/{condoId}/polls")
  public PageResponse<PollResponse> list(
      @PathVariable UUID condoId,
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "10") int size) {
    return service.listByCondominium(condoId, status, page, size);
  }

  @GetMapping("/polls/{id}")
  public PollDetailResponse getById(@PathVariable UUID id) {
    return service.getById(id);
  }
}
