-- =========================
-- USERS
-- =========================

CREATE SEQUENCE IF NOT EXISTS sequence_user START WITH 1 INCREMENT BY 1;

CREATE TABLE users (
    id BIGINT PRIMARY KEY DEFAULT nextval('sequence_user'),

    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,

    role VARCHAR(50) NOT NULL,

    account_locked BOOLEAN NOT NULL DEFAULT FALSE,
    email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

    failed_attempts INT NOT NULL DEFAULT 0,
    lock_until TIMESTAMP,

    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(255),

    last_password_change_at TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);



-- =========================
-- DEVICE SESSIONS
-- =========================

CREATE TABLE device_sessions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    session_id VARCHAR(255) NOT NULL UNIQUE,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,

    device_name VARCHAR(255),
    user_agent TEXT,
    os VARCHAR(255),
    browser VARCHAR(255),

    ip VARCHAR(45),
    country VARCHAR(255),

    created_at TIMESTAMP NOT NULL,
    last_active_at TIMESTAMP NOT NULL,

    CONSTRAINT fk_device_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_device_user_id ON device_sessions(user_id);
CREATE INDEX idx_device_session_id ON device_sessions(session_id);



-- =========================
-- SECURITY POLICY
-- =========================

CREATE SEQUENCE IF NOT EXISTS sequence_security_policy START WITH 1 INCREMENT BY 1;

CREATE TABLE user_security_policy (
    id BIGINT PRIMARY KEY DEFAULT nextval('sequence_security_policy'),

    user_id BIGINT UNIQUE,

    password_expiration_days INT NOT NULL,
    max_failed_attempts INT NOT NULL,
    lock_duration_seconds INT NOT NULL,

    CONSTRAINT fk_policy_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);