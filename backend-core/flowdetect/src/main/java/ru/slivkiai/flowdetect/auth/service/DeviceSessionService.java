package ru.slivkiai.flowdetect.auth.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;

import eu.bitwalker.useragentutils.UserAgent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import ru.slivkiai.flowdetect.user.domain.entity.DeviceSession;
import ru.slivkiai.flowdetect.user.domain.entity.User;
import ru.slivkiai.flowdetect.user.repository.DeviceSessionRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceSessionService {

    private final DeviceSessionRepository deviceSessionRepository;

    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private static final String IP_API_BASE = "https://ipapi.co/%s/country_name/";

    public DeviceSession createSession(User user, String deviceId, String ip, String userAgentString) {
        String country = resolveCountry(ip);

        UserAgent userAgent = UserAgent.parseUserAgentString(userAgentString);

        String browser = userAgent.getBrowser().getName();
        String os = userAgent.getOperatingSystem().getName();
        String deviceName = userAgent.getOperatingSystem().getDeviceType().getName();

        if (deviceId == null) {
            deviceId = UUID.randomUUID().toString(); // fallback
        }

        checkSuspiciousLogin(user, ip, country);

        DeviceSession session = DeviceSession.builder()
                .user(user)
                .sessionId(deviceId)
                .ip(ip)
                .userAgent(userAgentString)
                .country(country)
                .browser(browser)
                .os(os)
                .deviceName(deviceName)
                .revoked(false)
                .createdAt(LocalDateTime.now())
                .lastActiveAt(LocalDateTime.now())
                .build();

        return deviceSessionRepository.save(session);
    }

    // Проверка сессии
    public boolean isSessionValid(String deviceId) {
        return deviceSessionRepository.findBySessionId(deviceId)
                .map(session -> !session.isRevoked())
                .orElse(false);
    }

    // Обновление активности
    public void updateActivity(String deviceId) {
        deviceSessionRepository.findBySessionId(deviceId)
                .ifPresent(session -> {
                    session.setLastActiveAt(LocalDateTime.now());
                    deviceSessionRepository.save(session);
                });
    }

    // Логаут
    public void revokeSession(String deviceId) {
        deviceSessionRepository.findBySessionId(deviceId)
                .ifPresent(session -> {
                    session.setRevoked(true);
                    deviceSessionRepository.save(session);
                });
    }

    public void revokeAllUserSessions(Long userId) {
        var sessions = deviceSessionRepository.findByUserId(userId);
        sessions.forEach(session -> session.setRevoked(true));
        deviceSessionRepository.saveAll(sessions);
    }

    // GEO
    private String resolveCountry(String ip) {
        if (ip == null || ip.isBlank()) {
            return "UNKNOWN";
        }

        // локальные IP
        if (ip.startsWith("127.") || ip.startsWith("192.168.") || 
            ip.startsWith("10.") || ip.startsWith("172.16.") ||
            ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) {
            return "LOCAL";
        }

        try {
            String sanitizedIp = ip.replaceAll("[^\\d.:]", "");
            String url = String.format(IP_API_BASE, sanitizedIp);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(3))
                    .header("User-Agent", "FlowDetect/1.0")
                    .GET()
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(
                    request,
                    HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200 && response.body() != null) {
                return response.body().trim();
            }

            return "UNKNOWN";
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Geo lookup interrupted for IP {}: {}", ip, e.getMessage());
            return "UNKNOWN";

        } catch (Exception e) {
            log.warn("Failed to resolve country for IP {}: {}", ip, e.getMessage());
            return "UNKNOWN";
        }
    }

    // DETECTION
    private void checkSuspiciousLogin(User user, String ip, String country) {

        var sessions = deviceSessionRepository.findByUserId(user.getId());

        boolean knownIp = sessions.stream()
                .anyMatch(s -> ip.equals(s.getIp()));

        boolean knownCountry = sessions.stream()
                .anyMatch(s -> country.equals(s.getCountry()));

        if (!knownIp) {
            System.out.println("🚨 New IP detected: " + ip);
        }

        if (!knownCountry) {
            System.out.println("🚨 New country detected: " + country);
        }

        if (!knownIp || !knownCountry) {
            System.out.println("🚨 Suspicious login: "
                    + user.getEmail()
                    + " | IP=" + ip
                    + " | country=" + country);
        }
    }
}
