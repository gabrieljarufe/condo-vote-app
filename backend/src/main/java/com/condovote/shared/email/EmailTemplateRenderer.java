package com.condovote.shared.email;

import java.util.Locale;
import org.springframework.stereotype.Component;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

@Component
public class EmailTemplateRenderer {

  private final TemplateEngine templateEngine;

  public EmailTemplateRenderer(TemplateEngine templateEngine) {
    this.templateEngine = templateEngine;
  }

  public EmailMessage renderInvitation(String to, InvitationEmailVars vars) {
    Context ctx = new Context(Locale.forLanguageTag("pt-BR"));
    ctx.setVariable("condoName", vars.condoName());
    ctx.setVariable("aptLabel", vars.aptLabel());
    ctx.setVariable("roleLabel", vars.roleLabel());
    ctx.setVariable("acceptUrl", vars.acceptUrl());
    ctx.setVariable("expiresAtLabel", vars.expiresAtLabel());

    String html = templateEngine.process("email/invitation", ctx);
    String text = buildPlainText(vars);
    String subject = "Convite para " + vars.condoName() + " — apartamento " + vars.aptLabel();

    return new EmailMessage(to, subject, html, text);
  }

  private String buildPlainText(InvitationEmailVars vars) {
    return """
        Convite — Condo Vote

        Você foi convidado para participar de %s como %s do apartamento %s.

        Para aceitar e completar seu cadastro, abra este link:
        %s

        O link expira em %s.

        Se você não esperava este convite, ignore este e-mail.

        Condo Vote — Sistema de votação condominial
        """
        .formatted(
            vars.condoName(),
            vars.roleLabel(),
            vars.aptLabel(),
            vars.acceptUrl(),
            vars.expiresAtLabel());
  }

  public record InvitationEmailVars(
      String condoName,
      String aptLabel,
      String roleLabel,
      String acceptUrl,
      String expiresAtLabel) {}
}
