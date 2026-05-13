package com.condovote.shared.email;

public class EmailDeliveryException extends Exception {

  private final boolean hardBounce;

  public EmailDeliveryException(String message, Throwable cause, boolean hardBounce) {
    super(message, cause);
    this.hardBounce = hardBounce;
  }

  public EmailDeliveryException(String message, boolean hardBounce) {
    super(message);
    this.hardBounce = hardBounce;
  }

  public boolean isHardBounce() {
    return hardBounce;
  }
}
