package com.condovote.condominium;

import java.util.UUID;

public record CondominiumSummary(UUID id, String name, UserRoleInCondo role) {}
