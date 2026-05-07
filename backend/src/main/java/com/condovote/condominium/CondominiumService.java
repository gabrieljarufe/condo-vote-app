package com.condovote.condominium;

import com.condovote.auth.AuthGateway;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CondominiumService {

  private final CondominiumRepository condominiumRepository;
  private final AuthGateway authGateway;

  public CondominiumService(CondominiumRepository condominiumRepository, AuthGateway authGateway) {
    this.condominiumRepository = condominiumRepository;
    this.authGateway = authGateway;
  }

  @Transactional(readOnly = true)
  public List<CondominiumSummary> listForCurrentUser() {
    UUID userId = authGateway.getCurrentUserId();
    return condominiumRepository.findSummariesForUser(userId);
  }
}
