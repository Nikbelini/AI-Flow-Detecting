package ru.slivkiai.flowdetect.auth.service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.auth.model.OtpInfo;

@Service
@RequiredArgsConstructor
public class OtpService {
    
    private final EmailService emailService;

    private final Map<String, OtpInfo> otpStorage = new ConcurrentHashMap<>();
    private static final long EXPIRATION_TIME_MS = 5 * 60 * 1000;
    private static final SecureRandom random = new SecureRandom();

    public void generateAndSendOtp(String email) {
        String otp = String.format("%06d", random.nextInt(1_000_000));
        long expiration = Instant.now().toEpochMilli() + EXPIRATION_TIME_MS;

        otpStorage.put(email, new OtpInfo(email, otp, expiration));
        emailService.sendOtpEmail(email, otp);
    }

    public boolean verifyOtp(String email, String otp) {
        OtpInfo info = otpStorage.get(email);

        if (info == null) return false;

        boolean valid = info.otp().equals(otp) && Instant.now().toEpochMilli() < info.expirationTime();

        if (valid) {
            otpStorage.remove(email);
        }

        return valid;
    }

    public boolean checkOtpWithoutRemoval(String email, String otp) {
        OtpInfo info = otpStorage.get(email);
        if (info == null) return false;

        return info.otp().equals(otp) &&
                Instant.now().toEpochMilli() < info.expirationTime();
    }

    public void removeOtp(String email) {
        otpStorage.remove(email);
    }
}
