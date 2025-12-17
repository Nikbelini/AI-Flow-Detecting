package ru.slivkiai.flowdetect;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;

@SpringBootApplication
@EnableFeignClients
public class FlowdetectApplication {

	public static void main(String[] args) {
		SpringApplication.run(FlowdetectApplication.class, args);
	}
}
