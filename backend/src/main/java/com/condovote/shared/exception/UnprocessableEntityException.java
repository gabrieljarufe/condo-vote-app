package com.condovote.shared.exception;

public class UnprocessableEntityException extends RuntimeException {
  public UnprocessableEntityException(String message) {
    super(message);
  }
}
