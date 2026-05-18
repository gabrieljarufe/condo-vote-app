package com.condovote.poll;

import com.condovote.auth.AuthGateway;
import com.condovote.poll.dto.CastVoteRequest;
import com.condovote.poll.dto.VoteResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class VoteController {

  private final VoteService voteService;
  private final AuthGateway authGateway;

  public VoteController(VoteService voteService, AuthGateway authGateway) {
    this.voteService = voteService;
    this.authGateway = authGateway;
  }

  @PostMapping("/polls/{pollId}/vote")
  @ResponseStatus(HttpStatus.CREATED)
  public VoteResponse cast(
      @PathVariable UUID pollId,
      @Valid @RequestBody CastVoteRequest request,
      @RequestHeader(value = "X-Bulk-Operation", required = false, defaultValue = "false")
          boolean bulkOperation) {
    UUID voterUserId = authGateway.getCurrentUserId();
    return voteService.castVote(
        pollId, request.apartmentId(), request.optionId(), voterUserId, bulkOperation);
  }
}
