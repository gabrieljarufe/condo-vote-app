package com.condovote.apartment.dto;

import java.util.List;

public record BatchCreateApartmentResponse(
    List<ApartmentResponse> created, List<SkippedItem> skipped) {

  public record SkippedItem(String unitNumber, String block, SkipReason reason) {}

  public enum SkipReason {
    DUPLICATE
  }
}
