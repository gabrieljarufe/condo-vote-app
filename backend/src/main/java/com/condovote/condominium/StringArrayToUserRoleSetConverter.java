package com.condovote.condominium;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;

@ReadingConverter
public class StringArrayToUserRoleSetConverter
    implements Converter<String[], Set<UserRoleInCondo>> {
  @Override
  public Set<UserRoleInCondo> convert(String[] source) {
    if (source == null || source.length == 0) {
      return Set.of();
    }
    return Arrays.stream(source).map(UserRoleInCondo::valueOf).collect(Collectors.toSet());
  }
}
