package com.condovote.poll;

import com.condovote.poll.dto.MyBallotsResponse;
import com.condovote.poll.dto.MyPendingPollResponse;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class MyBallotsController {

  private final MyBallotsService myBallotsService;

  public MyBallotsController(MyBallotsService myBallotsService) {
    this.myBallotsService = myBallotsService;
  }

  @GetMapping("/polls/{pollId}/my-ballots")
  public MyBallotsResponse myBallots(@PathVariable UUID pollId) {
    return myBallotsService.getMyBallots(pollId);
  }

  @GetMapping("/condominiums/{condoId}/my-pending-polls")
  public List<MyPendingPollResponse> myPending(@PathVariable UUID condoId) {
    return myBallotsService.getMyPendingPolls(condoId);
  }
}
