package ru.slivkiai.flowdetect.user.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import eu.bitwalker.useragentutils.UserAgent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import ru.slivkiai.flowdetect.user.dto.DeviceSessionDto;
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

    private static final String IP_API_BASE = "https://ipwho.is/%s";

    private static final Map<String, CachedValue<String>> GEO_CACHE = new ConcurrentHashMap<>();
    private static final long GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000L;

    // ========================================================================
    // создание и обновление сессий
    // ========================================================================

    @Transactional
    public DeviceSession createOrUpdateSession(User user, String deviceId, String ip, String userAgentString) {

        // точный поиск по deviceId (с фронта)
        if (deviceId != null && !deviceId.isBlank()) {
            Optional<DeviceSession> existing = deviceSessionRepository
                    .findBySessionIdAndUserId(deviceId, user.getId());
            if (existing.isPresent() && !existing.get().isRevoked()) {
                log.debug("♻️ Reused session by deviceId: {} for user {}", deviceId, user.getEmail());
                return updateExistingSession(existing.get(), ip, userAgentString);
            }
        }

        // поиск по fingerprint (browser + OS + IP prefix)
        String fingerprint = generateDeviceFingerprint(userAgentString, ip);
        Optional<DeviceSession> byFp = deviceSessionRepository
                .findByUserIdAndDeviceFingerprintAndRevokedFalse(user.getId(), fingerprint);
        if (byFp.isPresent() && !byFp.get().isRevoked()) {
            log.debug("Reused session by fingerprint for user {}", user.getEmail());
            return updateExistingSession(byFp.get(), ip, userAgentString);
        }

        // берём последнюю активную сессию, если устройство похоже
        var lastActive = deviceSessionRepository
                .findByUserIdAndRevokedFalse(user.getId())
                .stream()
                .max(Comparator.comparing(DeviceSession::getLastActiveAt));

        if (lastActive.isPresent() && isSameDevice(lastActive.get(), userAgentString)) {
            log.debug("Reused last active session for user {}", user.getEmail());
            return updateExistingSession(lastActive.get(), ip, userAgentString);
        }

        // Создаём новую, если ничего не подошло
        log.debug("Created new session for user {}", user.getEmail());
        DeviceSession newSession = createSession(user, deviceId, ip, userAgentString);
        // Сохраняем fingerprint сразу для будущих поисков
        newSession.setDeviceFingerprint(fingerprint);
        return deviceSessionRepository.save(newSession);
    }

    public DeviceSession createSession(User user, String deviceId, String ip, String userAgentString) {
        String country = resolveCountry(ip);
        UserAgent userAgent = UserAgent.parseUserAgentString(userAgentString);

        String browser = Optional.ofNullable(userAgent.getBrowser()).map(b -> b.getName()).orElse("Unknown");
        String os = Optional.ofNullable(userAgent.getOperatingSystem()).map(o -> o.getName()).orElse("Unknown");
        String deviceName = Optional.ofNullable(userAgent.getOperatingSystem())
                .map(o -> o.getDeviceType().getName()).orElse("Unknown");

        // Если deviceId не передан — генерируем новый
        if (deviceId == null || deviceId.isBlank()) {
            deviceId = UUID.randomUUID().toString();
        }

        String fingerprint = generateDeviceFingerprint(userAgentString, ip);
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
                .deviceFingerprint(fingerprint)
                .revoked(false)
                .createdAt(LocalDateTime.now())
                .lastActiveAt(LocalDateTime.now())
                .build();

        return deviceSessionRepository.save(session);
    }

    // ========================================================================
    // ЧТЕНИЕ: получение списка сессий
    // ========================================================================

    public List<DeviceSessionDto> getActiveSessions(Long userId, String currentSessionId) {
        return deviceSessionRepository.findByUserId(userId).stream()
                .filter(s -> !s.isRevoked())
                .sorted(Comparator.comparing(DeviceSession::getLastActiveAt).reversed())
                .map(s -> new DeviceSessionDto(
                        s.getSessionId(),
                        s.getIp(),
                        s.getCountry(),
                        s.getBrowser(),
                        s.getOs(),
                        s.getDeviceName(),
                        s.getCreatedAt(),
                        s.getLastActiveAt(),
                        s.getSessionId().equals(currentSessionId),
                        false
                ))
                .collect(Collectors.toList());
    }

    // ========================================================================
    // УПРАВЛЕНИЕ: завершение сессий
    // ========================================================================

    @Transactional
    public boolean revokeSession(String sessionId, Long userId) {
        return deviceSessionRepository.findBySessionIdAndUserId(sessionId, userId)
                .map(session -> {
                    session.setRevoked(true);
                    deviceSessionRepository.save(session);
                    log.info("Session revoked: {} for user {}", sessionId, userId);
                    return true;
                }).orElse(false);
    }

    @Transactional
    public int revokeAllOtherSessions(String currentSessionId, Long userId) {
        var sessions = deviceSessionRepository.findByUserId(userId);
        int count = 0;
        for (var s : sessions) {
            if (!s.getSessionId().equals(currentSessionId) && !s.isRevoked()) {
                s.setRevoked(true);
                count++;
            }
        }
        if (count > 0) {
            deviceSessionRepository.saveAll(sessions);
            log.info("Revoked {} other sessions for user {}", count, userId);
        }
        return count;
    }

    @Transactional
    public void revokeAllUserSessions(Long userId) {
        var sessions = deviceSessionRepository.findByUserId(userId);
        sessions.forEach(s -> s.setRevoked(true));
        deviceSessionRepository.saveAll(sessions);
        log.info("All sessions revoked for user {}", userId);
    }

    public boolean isSessionValid(String sessionId) {
        return deviceSessionRepository.findBySessionId(sessionId)
                .map(s -> !s.isRevoked())
                .orElse(false);
    }

    @Transactional
    public void updateActivity(String sessionId) {
        deviceSessionRepository.findBySessionId(sessionId)
                .ifPresent(session -> {
                    session.setLastActiveAt(LocalDateTime.now());
                    deviceSessionRepository.save(session);
                });
    }

    private String resolveCountry(String ip) {
        if (ip == null || ip.isBlank()) return "UNKNOWN";
        if (isLocalIp(ip)) return "LOCAL";

        // Проверка кэша
        CachedValue<String> cached = GEO_CACHE.get(ip);
        if (cached != null && !cached.isExpired()) {
            return cached.value();
        }

        try {
            String sanitizedIp = sanitizeIpForApi(ip);
            if (sanitizedIp == null) {
                return "UNKNOWN";
            }

            String url = String.format(IP_API_BASE, sanitizedIp);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(3))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                String country = parseCountryFromJson(response.body());
                if (country != null && !country.isBlank()) {
                    GEO_CACHE.put(ip, new CachedValue<>(country));
                    return country;
                }
            }
            return "UNKNOWN";

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("Geo lookup interrupted for IP {}: {}", ip, e.getMessage());
            return "UNKNOWN";
        } catch (Exception e) {
            log.warn("Geo lookup failed for IP {}: {}", ip, e.getMessage());
            return "UNKNOWN"; // Не ломаем вход из-за гео!
        }
    }

    private String sanitizeIpForApi(String ip) {
        if (ip == null || ip.isBlank()) return null;

        // IPv4: x.x.x.x
        if (ip.matches("^\\d{1,3}(\\.\\d{1,3}){3}$")) {
            return ip;
        }

        // IPv6: содержит :: или много двоеточий — пропускаем
        if (ip.contains(":")) {
            log.debug("Skipping Geo lookup for IPv6: {}", ip);
            return null;
        }

        // fallback: убираем всё лишнее
        String cleaned = ip.replaceAll("[^\\d.]", "");
        return cleaned.matches("^\\d{1,3}(\\.\\d{1,3}){3}$") ? cleaned : null;
    }

    private boolean isLocalIp(String ip) {
        if (ip == null || ip.isBlank()) return true;

        return ip.equals("127.0.0.1") || ip.startsWith("127.") ||
                ip.startsWith("192.168.") ||
                ip.startsWith("10.") ||
                ip.startsWith("172.16.") || ip.startsWith("172.17.") ||
                ip.startsWith("172.18.") || ip.startsWith("172.19.") ||
                ip.startsWith("172.2") || ip.startsWith("172.30.") || ip.startsWith("172.31.") ||
                ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1") ||
                ip.equalsIgnoreCase("localhost");
    }

    private String parseCountryFromJson(String json) {
        if (json == null || json.isBlank()) return null;
        int keyIdx = json.indexOf("\"country\":");
        if (keyIdx == -1) return null;
        int start = json.indexOf('"', keyIdx + 10);
        if (start == -1) return null;
        int end = json.indexOf('"', start + 1);
        if (end == -1) return null;
        return json.substring(start + 1, end);
    }

    // ========================================================================
    // FINGERPRINT: отпечаток устройства для надёжного поиска
    // ========================================================================

    private String generateDeviceFingerprint(String userAgent, String ip) {
        UserAgent ua = UserAgent.parseUserAgentString(userAgent);
        String browser = Optional.ofNullable(ua.getBrowser()).map(b -> b.getName()).orElse("Unknown");
        String os = Optional.ofNullable(ua.getOperatingSystem()).map(o -> o.getName()).orElse("Unknown");

        // Берём первые 3 октета IPv4 для устойчивости к динамическим IP
        String ipPrefix = (ip != null && ip.matches("^\\d{1,3}(\\.\\d{1,3}){3}$"))
                ? Arrays.stream(ip.split("\\.")).limit(3).collect(Collectors.joining("."))
                : "ipv6-or-unknown";

        String raw = browser + "|" + os + "|" + ipPrefix;
        // Простой хеш без внешних зависимостей
        return String.valueOf(raw.hashCode());
    }

    private boolean isSameDevice(DeviceSession existing, String newUserAgent) {
        UserAgent ua = UserAgent.parseUserAgentString(newUserAgent);
        String newBrowser = Optional.ofNullable(ua.getBrowser()).map(b -> b.getName()).orElse("Unknown");
        String newOs = Optional.ofNullable(ua.getOperatingSystem()).map(o -> o.getName()).orElse("Unknown");

        return existing.getBrowser().equals(newBrowser) && existing.getOs().equals(newOs);
    }

    private DeviceSession updateExistingSession(DeviceSession session, String ip, String userAgent) {
        session.setIp(ip);
        session.setUserAgent(userAgent);
        session.setCountry(resolveCountry(ip));
        session.setLastActiveAt(LocalDateTime.now());

        UserAgent ua = UserAgent.parseUserAgentString(userAgent);
        session.setBrowser(Optional.ofNullable(ua.getBrowser()).map(b -> b.getName()).orElse("Unknown"));
        session.setOs(Optional.ofNullable(ua.getOperatingSystem()).map(o -> o.getName()).orElse("Unknown"));
        session.setDeviceName(Optional.ofNullable(ua.getOperatingSystem())
                .map(o -> o.getDeviceType().getName()).orElse("Unknown"));

        session.setDeviceFingerprint(generateDeviceFingerprint(userAgent, ip));

        return deviceSessionRepository.save(session);
    }


    private void checkSuspiciousLogin(User user, String ip, String country) {
        var sessions = deviceSessionRepository.findByUserId(user.getId());
        boolean knownIp = sessions.stream().anyMatch(s -> ip.equals(s.getIp()));
        boolean knownCountry = sessions.stream().anyMatch(s -> country.equals(s.getCountry()));

        if (!knownIp || !knownCountry) {
            log.warn("🚨 Suspicious login: {} | IP={} | Country={} | KnownIp={} | KnownCountry={}",
                    user.getEmail(), ip, country, knownIp, knownCountry);
        }
    }

    private static class CachedValue<T> {
        private final T value;
        private final long createdAt;

        CachedValue(T value) {
            this.value = value;
            this.createdAt = System.currentTimeMillis();
        }

        T value() {
            return value;
        }

        boolean isExpired() {
            return System.currentTimeMillis() - createdAt > GEO_CACHE_TTL_MS;
        }
    }
}