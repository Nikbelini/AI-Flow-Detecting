package ru.slivkiai.flowdetect.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.slivkiai.flowdetect.auth.service.EmailService;
import ru.slivkiai.flowdetect.auth.service.OtpService;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class OtpServiceTest {

    @Mock
    private EmailService emailService;

    @InjectMocks
    private OtpService otpService;

    @Test
    @DisplayName("generateAndSendOtp — генерирует 6-значный код и отправляет письмо")
    void generateAndSendOtp_sendsEmail() {
        otpService.generateAndSendOtp("user@example.com");

        verify(emailService).sendOtpEmail(eq("user@example.com"), argThat(otp -> otp != null && otp.matches("\\d{6}")));
    }

    @Test
    @DisplayName("generateAndSendOtp — повторный вызов перезаписывает старый код")
    void generateAndSendOtp_overwritesPreviousOtp() {
        otpService.generateAndSendOtp("user@example.com");
        otpService.generateAndSendOtp("user@example.com");

        verify(emailService, times(2)).sendOtpEmail(eq("user@example.com"), anyString());
    }

    @Test
    @DisplayName("verifyOtp — верный код → true, код удаляется из хранилища")
    void verifyOtp_correctCode_returnsTrue() {
        String capturedOtp = captureGeneratedOtp("user@example.com");

        boolean result = otpService.verifyOtp("user@example.com", capturedOtp);

        assertThat(result).isTrue();
        // повторная проверка должна вернуть false — код удалён
        assertThat(otpService.verifyOtp("user@example.com", capturedOtp)).isFalse();
    }

    @Test
    @DisplayName("verifyOtp — неверный код → false")
    void verifyOtp_wrongCode_returnsFalse() {
        captureGeneratedOtp("user@example.com");

        assertThat(otpService.verifyOtp("user@example.com", "000000")).isFalse();
    }

    @Test
    @DisplayName("verifyOtp — email не найден → false")
    void verifyOtp_unknownEmail_returnsFalse() {
        assertThat(otpService.verifyOtp("unknown@example.com", "123456")).isFalse();
    }

    @Test
    @DisplayName("verifyOtp — истёкший код → false")
    void verifyOtp_expiredCode_returnsFalse() throws Exception {
        injectExpiredOtp("expired@example.com", "123456");

        assertThat(otpService.verifyOtp("expired@example.com", "123456")).isFalse();
    }

    @Test
    @DisplayName("checkOtpWithoutRemoval — верный код → true, код остаётся в хранилище")
    void checkOtpWithoutRemoval_correctCode_returnsTrue() {
        String capturedOtp = captureGeneratedOtp("user@example.com");

        boolean first = otpService.checkOtpWithoutRemoval("user@example.com", capturedOtp);
        boolean second = otpService.checkOtpWithoutRemoval("user@example.com", capturedOtp);

        assertThat(first).isTrue();
        assertThat(second).isTrue(); // код не был удалён
    }

    @Test
    @DisplayName("checkOtpWithoutRemoval — неверный код → false")
    void checkOtpWithoutRemoval_wrongCode_returnsFalse() {
        captureGeneratedOtp("user@example.com");

        assertThat(otpService.checkOtpWithoutRemoval("user@example.com", "wrong")).isFalse();
    }

    @Test
    @DisplayName("checkOtpWithoutRemoval — истёкший код → false")
    void checkOtpWithoutRemoval_expiredCode_returnsFalse() throws Exception {
        injectExpiredOtp("expired@example.com", "654321");

        assertThat(otpService.checkOtpWithoutRemoval("expired@example.com", "654321")).isFalse();
    }

    @Test
    @DisplayName("removeOtp — после удаления код больше не принимается")
    void removeOtp_removesEntry() {
        String capturedOtp = captureGeneratedOtp("user@example.com");

        otpService.removeOtp("user@example.com");

        assertThat(otpService.verifyOtp("user@example.com", capturedOtp)).isFalse();
    }

    @Test
    @DisplayName("removeOtp — удаление несуществующего email не бросает исключение")
    void removeOtp_unknownEmailIsIdempotent() {
        assertThatCode(() -> otpService.removeOtp("nobody@example.com"))
                .doesNotThrowAnyException();
    }

    // Helpers

    // Перехват отп через Mockito - capture
    private String captureGeneratedOtp(String email) {
        org.mockito.ArgumentCaptor<String> captor = org.mockito.ArgumentCaptor.forClass(String.class);
        otpService.generateAndSendOtp(email);
        verify(emailService, atLeastOnce()).sendOtpEmail(eq(email), captor.capture());
        return captor.getValue();
    }

    // Инъектирует запись с уже истёкшим временем
    @SuppressWarnings("unchecked")
    private void injectExpiredOtp(String email, String otp) throws Exception {
        Field storageField = OtpService.class.getDeclaredField("otpStorage");
        storageField.setAccessible(true);

        Map<String, Object> storage = (Map<String, Object>) storageField.get(otpService);

        Class<?> otpInfoClass = Class.forName("ru.slivkiai.flowdetect.auth.model.OtpInfo");
        java.lang.reflect.Constructor<?> ctor = otpInfoClass.getDeclaredConstructor(
                String.class, String.class, long.class);
        ctor.setAccessible(true);

        long alreadyExpired = Instant.now().toEpochMilli() - 1000L;
        Object expiredInfo = ctor.newInstance(email, otp, alreadyExpired);
        storage.put(email, expiredInfo);
    }
}
