package com.condovote.shared.email;

// Implementação genérica SMTP: usa Inbucket em dev (docker compose) e GreenMail em testes de
// integração. Em prod é substituída por ResendEmailGateway (@Profile("prod")).

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.email.provider", havingValue = "smtp", matchIfMissing = true)
public class SmtpEmailGateway implements EmailGateway {

  private final JavaMailSender mailSender;
  private final String from;

  public SmtpEmailGateway(JavaMailSender mailSender, @Value("${app.email.from}") String from) {
    this.mailSender = mailSender;
    this.from = from;
  }

  @Override
  public void send(EmailMessage msg) throws EmailDeliveryException {
    MimeMessage mimeMessage = mailSender.createMimeMessage();
    try {
      MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
      helper.setFrom(from);
      helper.setTo(msg.to());
      helper.setSubject(msg.subject());
      String textBody = msg.textBody() != null ? msg.textBody() : "";
      helper.setText(textBody, msg.htmlBody());
    } catch (MessagingException e) {
      throw new EmailDeliveryException("Erro ao montar mensagem MIME: " + e.getMessage(), e, false);
    }

    try {
      mailSender.send(mimeMessage);
    } catch (MailException e) {
      throw new EmailDeliveryException("Falha no envio SMTP: " + e.getMessage(), e, false);
    }
  }
}
