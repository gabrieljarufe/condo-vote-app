package com.condovote.auth;

import java.util.UUID;

public interface AuthGateway {
    UUID getCurrentUserId();
    String getCurrentUserEmail();
}
