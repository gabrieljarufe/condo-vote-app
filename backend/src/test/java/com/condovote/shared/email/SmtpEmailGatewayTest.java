package com.condovote.shared.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

@ExtendWith(MockitoExtension.class)
class SmtpEmailGatewayTest {

  @Mock JavaMailSender mailSender;
  @Mock MimeMessage mimeMessage;

  SmtpEmailGateway gateway;

  @BeforeEach
  void setUp() {
    when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
    gateway = new SmtpEmailGateway(mailSender, "no-reply@test.local");
  }

  @Test
  void send_validMessage_callsJavaMailSenderSend() throws Exception {
    var msg = new EmailMessage("dest@example.com", "Convite", "<p>Olá</p>", "Olá");

    gateway.send(msg);

    verify(mailSender, times(1)).send(mimeMessage);
  }

  @Test
  void send_javaMailSenderThrowsMailException_wrapsInEmailDeliveryException() {
    var msg = new EmailMessage("dest@example.com", "Convite", "<p>Olá</p>", null);
    doThrow(new MailSendException("connection refused"))
        .when(mailSender)
        .send(any(MimeMessage.class));

    assertThatThrownBy(() -> gateway.send(msg))
        .isInstanceOf(EmailDeliveryException.class)
        .satisfies(ex -> assertThat(((EmailDeliveryException) ex).isHardBounce()).isFalse());
  }

  @Test
  void send_validMessage_withNullTextBody_doesNotThrow() throws Exception {
    var msg = new EmailMessage("dest@example.com", "Convite", "<p>Olá</p>", null);

    gateway.send(msg);

    verify(mailSender, times(1)).send(mimeMessage);
  }
}
