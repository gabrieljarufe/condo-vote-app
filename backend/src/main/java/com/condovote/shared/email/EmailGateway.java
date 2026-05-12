package com.condovote.shared.email;

public interface EmailGateway {

  void send(EmailMessage message) throws EmailDeliveryException;
}
