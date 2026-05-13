package com.condovote.shared.email;

public record EmailMessage(String to, String subject, String htmlBody, String textBody) {

  public EmailMessage {
    if (to == null || to.isBlank()) throw new IllegalArgumentException("to obrigatório");
    if (subject == null || subject.isBlank())
      throw new IllegalArgumentException("subject obrigatório");
    if (htmlBody == null || htmlBody.isBlank())
      throw new IllegalArgumentException("htmlBody obrigatório");
    // textBody opcional — null é aceito
  }
}
