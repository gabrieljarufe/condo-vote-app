package com.condovote.shared.email;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class EmailMessageTest {

  @Test
  void constructor_validArgs_creates() {
    var msg = new EmailMessage("dest@example.com", "Assunto", "<p>Corpo</p>", "Corpo");
    assertThat(msg.to()).isEqualTo("dest@example.com");
    assertThat(msg.subject()).isEqualTo("Assunto");
    assertThat(msg.htmlBody()).isEqualTo("<p>Corpo</p>");
    assertThat(msg.textBody()).isEqualTo("Corpo");
  }

  @Test
  void constructor_textBodyNull_allowed() {
    var msg = new EmailMessage("dest@example.com", "Assunto", "<p>Corpo</p>", null);
    assertThat(msg.textBody()).isNull();
  }

  @Test
  void constructor_toNull_throws() {
    assertThatThrownBy(() -> new EmailMessage(null, "Assunto", "<p>html</p>", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("to obrigatório");
  }

  @Test
  void constructor_toBlank_throws() {
    assertThatThrownBy(() -> new EmailMessage("  ", "Assunto", "<p>html</p>", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("to obrigatório");
  }

  @Test
  void constructor_subjectNull_throws() {
    assertThatThrownBy(() -> new EmailMessage("dest@example.com", null, "<p>html</p>", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("subject obrigatório");
  }

  @Test
  void constructor_subjectBlank_throws() {
    assertThatThrownBy(() -> new EmailMessage("dest@example.com", "", "<p>html</p>", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("subject obrigatório");
  }

  @Test
  void constructor_htmlBodyNull_throws() {
    assertThatThrownBy(() -> new EmailMessage("dest@example.com", "Assunto", null, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("htmlBody obrigatório");
  }

  @Test
  void constructor_htmlBodyBlank_throws() {
    assertThatThrownBy(() -> new EmailMessage("dest@example.com", "Assunto", "   ", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("htmlBody obrigatório");
  }
}
