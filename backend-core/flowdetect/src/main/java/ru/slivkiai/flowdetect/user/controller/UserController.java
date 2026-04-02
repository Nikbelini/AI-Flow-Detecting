package ru.slivkiai.flowdetect.user.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import ru.slivkiai.flowdetect.auth.dto.OtpVerifyRequest;
import ru.slivkiai.flowdetect.auth.model.CustomUserDetails;
import ru.slivkiai.flowdetect.user.dto.ChangePassword;
import ru.slivkiai.flowdetect.user.dto.UserGetResponse;
import ru.slivkiai.flowdetect.user.dto.UserUpdate;
import ru.slivkiai.flowdetect.user.service.UserService;

@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<UserGetResponse> me(@AuthenticationPrincipal CustomUserDetails user) {
        return ResponseEntity.ok(userService.getMe(user.getId()));
    }

    @PutMapping("/update")
    public ResponseEntity<UserGetResponse> update(@AuthenticationPrincipal CustomUserDetails user,
            @RequestBody UserUpdate dto) {
        return ResponseEntity.ok(userService.updateMe(user.getId(), dto));
    }

    @PutMapping("/change-password")
    public ResponseEntity<Void> changePassword(@AuthenticationPrincipal CustomUserDetails user,
        @RequestBody ChangePassword dto) {
        userService.changePassword(user.getId(), dto);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/confirm/request")
    public ResponseEntity<String> requestConfirmation(
            @AuthenticationPrincipal CustomUserDetails user) {
        userService.requestConfirmationOtp(user.getId());
        return ResponseEntity.ok("Код подтверждения отправлен на " + user.getUsername());
    }

    @PostMapping("/confirm")
    public ResponseEntity<String> confirmEmailAndEnable2fa(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody @Valid OtpVerifyRequest dto) {
        userService.confirmEmailAndEnable2fa(user.getId(), dto.otp());
        return ResponseEntity.ok("Почта подтверждена. Двухфакторная аутентификация включена.");
    }

    @PostMapping("/2fa/disable")
    public ResponseEntity<String> disableTwoFactor(
            @AuthenticationPrincipal CustomUserDetails user,
            @RequestBody @Valid OtpVerifyRequest dto) {
        userService.disableTwoFactorOnly(user.getId(), dto.otp());
        return ResponseEntity.ok("🔓 Двухфакторная аутентификация отключена");
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal CustomUserDetails user) {
        userService.deleteMe(user.getId());
        return ResponseEntity.noContent().build();
    }

}
