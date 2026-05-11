package com.condovote.condominium;

import java.util.Set;
import java.util.UUID;

public record CondominiumSummary(UUID id, String name, Set<UserRoleInCondo> roles) {}
