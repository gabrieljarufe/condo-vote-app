package com.condovote;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CondoVoteApplication {

  public static void main(String[] args) {
    SpringApplication.run(CondoVoteApplication.class, args);
  }
}
