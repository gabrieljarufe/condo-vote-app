package com.condovote.shared.email;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

class EmailTemplateRendererTest {

  private EmailTemplateRenderer renderer;

  @BeforeEach
  void setUp() {
    ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
    resolver.setPrefix("templates/");
    resolver.setSuffix(".html");
    resolver.setTemplateMode("HTML");
    resolver.setCharacterEncoding("UTF-8");

    SpringTemplateEngine engine = new SpringTemplateEngine();
    engine.setTemplateResolver(resolver);

    renderer = new EmailTemplateRenderer(engine);
  }

  private EmailTemplateRenderer.InvitationEmailVars buildVars() {
    return new EmailTemplateRenderer.InvitationEmailVars(
        "Condomínio Jardim das Flores",
        "Bloco A · 101",
        "Proprietário",
        "https://app.condovote.com.br/convite/aceitar?token=abc123");
  }

  @Test
  void renderInvitation_validVars_returnsEmailMessageWithExpectedSubject() {
    var vars = buildVars();
    EmailMessage msg = renderer.renderInvitation("morador@example.com", vars);

    assertThat(msg.subject()).contains(vars.condoName());
    assertThat(msg.subject()).contains(vars.aptLabel());
  }

  @Test
  void renderInvitation_validVars_htmlContainsAllVars() {
    var vars = buildVars();
    EmailMessage msg = renderer.renderInvitation("morador@example.com", vars);

    assertThat(msg.htmlBody()).contains(vars.condoName());
    assertThat(msg.htmlBody()).contains(vars.aptLabel());
    assertThat(msg.htmlBody()).contains(vars.roleLabel());
    assertThat(msg.htmlBody()).contains(vars.acceptUrl());
    assertThat(msg.htmlBody()).contains("24 horas");
  }

  @Test
  void renderInvitation_validVars_textBodyContainsAllVars() {
    var vars = buildVars();
    EmailMessage msg = renderer.renderInvitation("morador@example.com", vars);

    assertThat(msg.textBody()).contains(vars.condoName());
    assertThat(msg.textBody()).contains(vars.aptLabel());
    assertThat(msg.textBody()).contains(vars.roleLabel());
    assertThat(msg.textBody()).contains(vars.acceptUrl());
    assertThat(msg.textBody()).contains("24 horas");
  }

  @Test
  void renderInvitation_acceptUrlInHtml_isProperlyEscaped() {
    var vars =
        new EmailTemplateRenderer.InvitationEmailVars(
            "Condomínio Test",
            "Bloco B · 202",
            "Inquilino",
            "https://app.condovote.com.br/convite/aceitar?token=abc&ref=email");

    EmailMessage msg = renderer.renderInvitation("morador@example.com", vars);

    assertThat(msg.htmlBody()).contains("&amp;");
  }
}
