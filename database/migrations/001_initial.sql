BEGIN;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(16) NOT NULL DEFAULT 'USER',
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_users_role
        CHECK (role IN ('USER', 'ADMIN')),

    CONSTRAINT chk_users_email_not_empty
        CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX uq_users_email_lower
    ON users (LOWER(email));


CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    refresh_token_hash BYTEA NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,

    revoked_at TIMESTAMPTZ NULL,
    revoked_by_user_id UUID NULL,

    ip_address INET NULL,
    user_agent TEXT NULL,

    CONSTRAINT fk_sessions_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sessions_revoked_by
        FOREIGN KEY (revoked_by_user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT uq_sessions_refresh_token_hash
        UNIQUE (refresh_token_hash),

    CONSTRAINT chk_sessions_refresh_hash_length
        CHECK (octet_length(refresh_token_hash) = 32),

    CONSTRAINT chk_sessions_expiration
        CHECK (expires_at > created_at),

    CONSTRAINT chk_sessions_last_activity
        CHECK (last_activity_at >= created_at),

    CONSTRAINT chk_sessions_revoked_at
        CHECK (
            revoked_at IS NULL
            OR revoked_at >= created_at
        ),

    CONSTRAINT chk_sessions_revoked_by
        CHECK (
            revoked_by_user_id IS NULL
            OR revoked_at IS NOT NULL
        )
);

CREATE INDEX idx_sessions_user_id
    ON sessions (user_id);

CREATE INDEX idx_sessions_active_user
    ON sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE login_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id UUID NULL,

    login_key_hash BYTEA NOT NULL,

    ip_address INET NOT NULL,

    attempted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    success BOOLEAN NOT NULL,

    CONSTRAINT fk_login_attempts_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_login_attempts_hash_length
        CHECK (octet_length(login_key_hash) = 32)
);

CREATE INDEX idx_failed_login_account
    ON login_attempts (login_key_hash, attempted_at DESC)
    WHERE success = FALSE;

CREATE INDEX idx_failed_login_ip
    ON login_attempts (ip_address, attempted_at DESC)
    WHERE success = FALSE;

CREATE INDEX idx_login_attempts_time
    ON login_attempts (attempted_at);


CREATE TABLE trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL,

    title VARCHAR(120) NOT NULL,
    destination VARCHAR(255) NOT NULL,

    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    planned_budget NUMERIC(12, 2) NOT NULL,

    currency CHAR(3) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_trips_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_trips_title
        CHECK (btrim(title) <> ''),

    CONSTRAINT chk_trips_destination
        CHECK (btrim(destination) <> ''),

    CONSTRAINT chk_trips_dates
        CHECK (end_date >= start_date),

    CONSTRAINT chk_trips_budget
        CHECK (planned_budget >= 0),

    CONSTRAINT chk_trips_currency
        CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE INDEX idx_trips_user_created
    ON trips (user_id, created_at DESC);


-- ============================================================
-- TRIP DAYS
-- ============================================================

CREATE TABLE trip_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    trip_id UUID NOT NULL,
    day_date DATE NOT NULL,

    CONSTRAINT fk_trip_days_trip
        FOREIGN KEY (trip_id)
        REFERENCES trips(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_trip_days_trip_date
        UNIQUE (trip_id, day_date)
);

CREATE TABLE places (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    trip_day_id UUID NOT NULL,

    name VARCHAR(255) NOT NULL,
    address TEXT NULL,
    planned_time TIME NULL,
    note TEXT NULL,

    position INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_places_trip_day
        FOREIGN KEY (trip_day_id)
        REFERENCES trip_days(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_places_name
        CHECK (btrim(name) <> ''),

    CONSTRAINT chk_places_position
        CHECK (position > 0),

    CONSTRAINT uq_places_day_position
        UNIQUE (trip_day_id, position)
        DEFERRABLE INITIALLY IMMEDIATE
);


CREATE TABLE expense_categories (
    id SMALLINT PRIMARY KEY,

    code VARCHAR(32) NOT NULL,
    name VARCHAR(64) NOT NULL,

    CONSTRAINT uq_expense_categories_code
        UNIQUE (code),

    CONSTRAINT chk_expense_categories_code
        CHECK (btrim(code) <> ''),

    CONSTRAINT chk_expense_categories_name
        CHECK (btrim(name) <> '')
);


CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    trip_id UUID NOT NULL,
    category_id SMALLINT NOT NULL,

    description VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,

    expense_date DATE NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_expenses_trip
        FOREIGN KEY (trip_id)
        REFERENCES trips(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_expenses_category
        FOREIGN KEY (category_id)
        REFERENCES expense_categories(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_expenses_description
        CHECK (btrim(description) <> ''),

    CONSTRAINT chk_expenses_amount
        CHECK (amount > 0)
);

CREATE INDEX idx_expenses_trip_category
    ON expenses (trip_id, category_id);

CREATE INDEX idx_expenses_trip_date
    ON expenses (trip_id, expense_date);


CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trips_updated_at
BEFORE UPDATE ON trips
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_places_updated_at
BEFORE UPDATE ON places
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


COMMIT;