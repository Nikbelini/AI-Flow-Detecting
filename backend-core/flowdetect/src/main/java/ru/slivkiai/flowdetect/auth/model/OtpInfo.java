package ru.slivkiai.flowdetect.auth.model;

public class OtpInfo {
    private final String email;

    private final String otp;

    private final long expirationTime;

    public OtpInfo(String email, String otp, long expirationTime) {
        this.email = email;
        this.otp = otp;
        this.expirationTime = expirationTime;
    }

    public String email() { return email; }

    public String otp() { return otp; }
    
    public long expirationTime() { return expirationTime; }
}
