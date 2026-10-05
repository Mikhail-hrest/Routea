-- ============================================================
-- ROUTEA DATABASE TESTS
-- ============================================================

-- Результаты текущего запуска.
CREATE TEMP TABLE test_results (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    test_name TEXT NOT NULL,
    passed BOOLEAN NOT NULL,
    details TEXT
);


-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION pg_temp.test_assert(
    p_name TEXT,
    p_condition BOOLEAN,
    p_details TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO test_results(test_name, passed, details)
    VALUES (
        p_name,
        COALESCE(p_condition, FALSE),
        p_details
    );
END;
$$;


CREATE OR REPLACE FUNCTION pg_temp.expect_error(
    p_name TEXT,
    p_sql TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE p_sql;

        INSERT INTO test_results(test_name, passed, details)
        VALUES (
            p_name,
            FALSE,
            'Ожидалась ошибка, но запрос успешно выполнился'
        );

    EXCEPTION
        WHEN OTHERS THEN
            INSERT INTO test_results(test_name, passed, details)
            VALUES (
                p_name,
                TRUE,
                SQLSTATE || ': ' || SQLERRM
            );
    END;
END;
$$;


-- ============================================================
-- CONTEXT
-- ============================================================

CREATE TEMP TABLE test_context (
    user_id UUID,
    session_id UUID,
    trip_id UUID,
    day1_id UUID,
    day2_id UUID,
    place_id UUID,
    expense_id UUID
);


-- ============================================================
-- CLEANUP FROM PREVIOUS FAILED RUN
-- ============================================================

DELETE FROM login_attempts
WHERE login_key_hash = decode(repeat('11', 32), 'hex');

DELETE FROM trips
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE LOWER(email) = 'dbtest@routea.test'
);

DELETE FROM users
WHERE LOWER(email) = 'dbtest@routea.test';


-- ============================================================
-- 1. STRUCTURE
-- ============================================================

SELECT pg_temp.test_assert(
    'Созданы все 8 таблиц',
    (
        SELECT COUNT(*) = 8
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN (
              'users',
              'sessions',
              'login_attempts',
              'trips',
              'trip_days',
              'places',
              'expense_categories',
              'expenses'
          )
    )
);


SELECT pg_temp.test_assert(
    'Созданы 6 стандартных категорий расходов',
    (
        SELECT COUNT(*) = 6
        FROM expense_categories
        WHERE code IN (
            'TRANSPORT',
            'ACCOMMODATION',
            'FOOD',
            'ENTERTAINMENT',
            'SHOPPING',
            'OTHER'
        )
    )
);


-- ============================================================
-- 2. USERS
-- ============================================================

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    INSERT INTO users (
        email,
        password_hash
    )
    VALUES (
        'dbtest@routea.test',
        'TEST_HASH_NOT_REAL_PASSWORD'
    )
    RETURNING id INTO v_user_id;

    INSERT INTO test_context(user_id)
    VALUES (v_user_id);

    PERFORM pg_temp.test_assert(
        'Пользователь успешно создаётся',
        v_user_id IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Пользователь успешно создаётся',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


SELECT pg_temp.test_assert(
    'Новая роль по умолчанию USER',
    (
        SELECT role = 'USER'
        FROM users
        WHERE id = (SELECT user_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.test_assert(
    'Новый пользователь не заблокирован',
    (
        SELECT is_blocked = FALSE
        FROM users
        WHERE id = (SELECT user_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.expect_error(
    'Email уникален без учёта регистра',
    $$
    INSERT INTO users(email, password_hash)
    VALUES ('DBTEST@ROUTEA.TEST', 'HASH')
    $$
);


SELECT pg_temp.expect_error(
    'Нельзя создать неизвестную роль',
    $$
    INSERT INTO users(email, password_hash, role)
    VALUES (
        'bad-role@routea.test',
        'HASH',
        'ROOT'
    )
    $$
);


SELECT pg_temp.expect_error(
    'Нельзя создать пользователя с пустым email',
    $$
    INSERT INTO users(email, password_hash)
    VALUES ('', 'HASH')
    $$
);


-- Проверяем trigger updated_at.
UPDATE users
SET updated_at = TIMESTAMPTZ '2000-01-01 00:00:00+00'
WHERE id = (SELECT user_id FROM test_context LIMIT 1);


SELECT pg_temp.test_assert(
    'Trigger users.updated_at работает',
    (
        SELECT updated_at > TIMESTAMPTZ '2000-01-01'
        FROM users
        WHERE id = (SELECT user_id FROM test_context LIMIT 1)
    )
);


-- ============================================================
-- 3. SESSIONS
-- ============================================================

DO $$
DECLARE
    v_session_id UUID;
    v_user_id UUID;
BEGIN
    SELECT user_id
    INTO v_user_id
    FROM test_context
    LIMIT 1;

    INSERT INTO sessions (
        user_id,
        refresh_token_hash,
        expires_at,
        ip_address,
        user_agent
    )
    VALUES (
        v_user_id,
        decode(repeat('AA', 32), 'hex'),
        CURRENT_TIMESTAMP + INTERVAL '7 days',
        '127.0.0.1',
        'Routea database test'
    )
    RETURNING id INTO v_session_id;

    UPDATE test_context
    SET session_id = v_session_id;

    PERFORM pg_temp.test_assert(
        'Корректная сессия создаётся',
        v_session_id IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Корректная сессия создаётся',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


SELECT pg_temp.expect_error(
    'Refresh-token hash должен иметь длину 32 байта',
    format(
        $sql$
        INSERT INTO sessions(
            user_id,
            refresh_token_hash,
            expires_at
        )
        VALUES (
            %L::uuid,
            decode(repeat('BB', 31), 'hex'),
            CURRENT_TIMESTAMP + INTERVAL '7 days'
        )
        $sql$,
        (SELECT user_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.expect_error(
    'Сессия не может истекать раньше создания',
    format(
        $sql$
        INSERT INTO sessions(
            user_id,
            refresh_token_hash,
            expires_at
        )
        VALUES (
            %L::uuid,
            decode(repeat('CC', 32), 'hex'),
            CURRENT_TIMESTAMP - INTERVAL '1 hour'
        )
        $sql$,
        (SELECT user_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.expect_error(
    'Нельзя указать revoked_by без revoked_at',
    format(
        $sql$
        INSERT INTO sessions(
            user_id,
            refresh_token_hash,
            expires_at,
            revoked_by_user_id
        )
        VALUES (
            %L::uuid,
            decode(repeat('DD', 32), 'hex'),
            CURRENT_TIMESTAMP + INTERVAL '7 days',
            %L::uuid
        )
        $sql$,
        (SELECT user_id FROM test_context LIMIT 1),
        (SELECT user_id FROM test_context LIMIT 1)
    )
);


-- ============================================================
-- 4. LOGIN ATTEMPTS
-- ============================================================

DO $$
DECLARE
    v_user_id UUID;
    v_id BIGINT;
BEGIN
    SELECT user_id
    INTO v_user_id
    FROM test_context
    LIMIT 1;

    INSERT INTO login_attempts(
        user_id,
        login_key_hash,
        ip_address,
        success
    )
    VALUES (
        v_user_id,
        decode(repeat('11', 32), 'hex'),
        '127.0.0.1',
        FALSE
    )
    RETURNING id INTO v_id;

    PERFORM pg_temp.test_assert(
        'Попытка входа успешно журналируется',
        v_id IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Попытка входа успешно журналируется',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


SELECT pg_temp.expect_error(
    'login_key_hash должен иметь длину 32 байта',
    $$
    INSERT INTO login_attempts(
        login_key_hash,
        ip_address,
        success
    )
    VALUES (
        decode(repeat('22', 31), 'hex'),
        '127.0.0.1',
        FALSE
    )
    $$
);


-- ============================================================
-- 5. TRIPS
-- ============================================================

DO $$
DECLARE
    v_user_id UUID;
    v_trip_id UUID;
BEGIN
    SELECT user_id
    INTO v_user_id
    FROM test_context
    LIMIT 1;

    INSERT INTO trips(
        user_id,
        title,
        destination,
        start_date,
        end_date,
        planned_budget,
        currency
    )
    VALUES (
        v_user_id,
        'Тестовая поездка',
        'Рим, Италия',
        DATE '2027-07-10',
        DATE '2027-07-15',
        2500.00,
        'EUR'
    )
    RETURNING id INTO v_trip_id;

    UPDATE test_context
    SET trip_id = v_trip_id;

    PERFORM pg_temp.test_assert(
        'Корректная поездка создаётся',
        v_trip_id IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Корректная поездка создаётся',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


SELECT pg_temp.expect_error(
    'Дата окончания не может быть раньше даты начала',
    format(
        $sql$
        INSERT INTO trips(
            user_id,
            title,
            destination,
            start_date,
            end_date,
            planned_budget,
            currency
        )
        VALUES (
            %L::uuid,
            'Bad dates',
            'Rome',
            DATE '2027-07-15',
            DATE '2027-07-10',
            100,
            'EUR'
        )
        $sql$,
        (SELECT user_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.expect_error(
    'Бюджет не может быть отрицательным',
    format(
        $sql$
        INSERT INTO trips(
            user_id,
            title,
            destination,
            start_date,
            end_date,
            planned_budget,
            currency
        )
        VALUES (
            %L::uuid,
            'Bad budget',
            'Rome',
            DATE '2027-07-10',
            DATE '2027-07-15',
            -1,
            'EUR'
        )
        $sql$,
        (SELECT user_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.expect_error(
    'Код валюты должен состоять из трёх заглавных букв',
    format(
        $sql$
        INSERT INTO trips(
            user_id,
            title,
            destination,
            start_date,
            end_date,
            planned_budget,
            currency
        )
        VALUES (
            %L::uuid,
            'Bad currency',
            'Rome',
            DATE '2027-07-10',
            DATE '2027-07-15',
            100,
            'eur'
        )
        $sql$,
        (SELECT user_id FROM test_context LIMIT 1)
    )
);


UPDATE trips
SET updated_at = TIMESTAMPTZ '2000-01-01'
WHERE id = (SELECT trip_id FROM test_context LIMIT 1);


SELECT pg_temp.test_assert(
    'Trigger trips.updated_at работает',
    (
        SELECT updated_at > TIMESTAMPTZ '2000-01-01'
        FROM trips
        WHERE id = (SELECT trip_id FROM test_context LIMIT 1)
    )
);


-- ============================================================
-- 6. TRIP DAYS
-- ============================================================

DO $$
DECLARE
    v_trip_id UUID;
    v_day1 UUID;
    v_day2 UUID;
BEGIN
    SELECT trip_id
    INTO v_trip_id
    FROM test_context
    LIMIT 1;

    INSERT INTO trip_days(trip_id, day_date)
    VALUES (v_trip_id, DATE '2027-07-10')
    RETURNING id INTO v_day1;

    INSERT INTO trip_days(trip_id, day_date)
    VALUES (v_trip_id, DATE '2027-07-11')
    RETURNING id INTO v_day2;

    UPDATE test_context
    SET
        day1_id = v_day1,
        day2_id = v_day2;

    PERFORM pg_temp.test_assert(
        'Дни поездки создаются',
        v_day1 IS NOT NULL AND v_day2 IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Дни поездки создаются',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


SELECT pg_temp.expect_error(
    'Одна дата не может существовать дважды в одной поездке',
    format(
        $sql$
        INSERT INTO trip_days(trip_id, day_date)
        VALUES (%L::uuid, DATE '2027-07-10')
        $sql$,
        (SELECT trip_id FROM test_context LIMIT 1)
    )
);


-- ============================================================
-- 7. PLACES
-- ============================================================

DO $$
DECLARE
    v_day_id UUID;
    v_place_id UUID;
BEGIN
    SELECT day1_id
    INTO v_day_id
    FROM test_context
    LIMIT 1;

    INSERT INTO places(
        trip_day_id,
        name,
        address,
        planned_time,
        note,
        position
    )
    VALUES (
        v_day_id,
        'Колизей',
        'Piazza del Colosseo, Roma',
        TIME '10:00',
        'Купить билеты заранее',
        1
    )
    RETURNING id INTO v_place_id;

    UPDATE test_context
    SET place_id = v_place_id;

    PERFORM pg_temp.test_assert(
        'Место маршрута создаётся',
        v_place_id IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Место маршрута создаётся',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


SELECT pg_temp.expect_error(
    'Позиция места должна быть больше нуля',
    format(
        $sql$
        INSERT INTO places(
            trip_day_id,
            name,
            position
        )
        VALUES (
            %L::uuid,
            'Invalid position',
            0
        )
        $sql$,
        (SELECT day1_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.expect_error(
    'Два места не могут иметь одну позицию в одном дне',
    format(
        $sql$
        INSERT INTO places(
            trip_day_id,
            name,
            position
        )
        VALUES (
            %L::uuid,
            'Duplicate position',
            1
        )
        $sql$,
        (SELECT day1_id FROM test_context LIMIT 1)
    )
);


UPDATE places
SET updated_at = TIMESTAMPTZ '2000-01-01'
WHERE id = (SELECT place_id FROM test_context LIMIT 1);


SELECT pg_temp.test_assert(
    'Trigger places.updated_at работает',
    (
        SELECT updated_at > TIMESTAMPTZ '2000-01-01'
        FROM places
        WHERE id = (SELECT place_id FROM test_context LIMIT 1)
    )
);


-- ============================================================
-- 8. EXPENSES
-- ============================================================

DO $$
DECLARE
    v_trip_id UUID;
    v_expense_id UUID;
BEGIN
    SELECT trip_id
    INTO v_trip_id
    FROM test_context
    LIMIT 1;

    INSERT INTO expenses(
        trip_id,
        category_id,
        description,
        amount,
        expense_date
    )
    VALUES (
        v_trip_id,
        1,
        'Билеты на поезд',
        75.50,
        DATE '2027-07-10'
    )
    RETURNING id INTO v_expense_id;

    UPDATE test_context
    SET expense_id = v_expense_id;

    PERFORM pg_temp.test_assert(
        'Корректный расход создаётся',
        v_expense_id IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Корректный расход создаётся',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


SELECT pg_temp.expect_error(
    'Расход не может быть равен нулю',
    format(
        $sql$
        INSERT INTO expenses(
            trip_id,
            category_id,
            description,
            amount
        )
        VALUES (
            %L::uuid,
            1,
            'Zero expense',
            0
        )
        $sql$,
        (SELECT trip_id FROM test_context LIMIT 1)
    )
);


SELECT pg_temp.expect_error(
    'Расход не может быть отрицательным',
    format(
        $sql$
        INSERT INTO expenses(
            trip_id,
            category_id,
            description,
            amount
        )
        VALUES (
            %L::uuid,
            1,
            'Negative expense',
            -100
        )
        $sql$,
        (SELECT trip_id FROM test_context LIMIT 1)
    )
);


-- Проверяем наше решение: расход может быть сделан до поездки.
DO $$
DECLARE
    v_trip_id UUID;
    v_id UUID;
BEGIN
    SELECT trip_id
    INTO v_trip_id
    FROM test_context
    LIMIT 1;

    INSERT INTO expenses(
        trip_id,
        category_id,
        description,
        amount,
        expense_date
    )
    VALUES (
        v_trip_id,
        2,
        'Предварительная бронь гостиницы',
        500,
        DATE '2027-05-01'
    )
    RETURNING id INTO v_id;

    PERFORM pg_temp.test_assert(
        'Расход может иметь дату до начала поездки',
        v_id IS NOT NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Расход может иметь дату до начала поездки',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


UPDATE expenses
SET updated_at = TIMESTAMPTZ '2000-01-01'
WHERE id = (SELECT expense_id FROM test_context LIMIT 1);


SELECT pg_temp.test_assert(
    'Trigger expenses.updated_at работает',
    (
        SELECT updated_at > TIMESTAMPTZ '2000-01-01'
        FROM expenses
        WHERE id = (SELECT expense_id FROM test_context LIMIT 1)
    )
);


-- ============================================================
-- 9. DELETE RULES
-- ============================================================

SELECT pg_temp.expect_error(
    'Используемую категорию расходов нельзя удалить',
    $$
    DELETE FROM expense_categories
    WHERE id = 1
    $$
);


SELECT pg_temp.expect_error(
    'Пользователя с существующей поездкой нельзя физически удалить',
    format(
        'DELETE FROM users WHERE id = %L::uuid',
        (SELECT user_id FROM test_context LIMIT 1)
    )
);


-- ============================================================
-- 10. CASCADE DELETE TRIP
-- ============================================================

DO $$
DECLARE
    v_trip UUID;
    v_day_count INTEGER;
    v_place_count INTEGER;
    v_expense_count INTEGER;
BEGIN
    SELECT trip_id
    INTO v_trip
    FROM test_context
    LIMIT 1;

    DELETE FROM trips
    WHERE id = v_trip;

    SELECT COUNT(*)
    INTO v_day_count
    FROM trip_days
    WHERE trip_id = v_trip;

    SELECT COUNT(*)
    INTO v_place_count
    FROM places p
    JOIN trip_days td ON td.id = p.trip_day_id
    WHERE td.trip_id = v_trip;

    SELECT COUNT(*)
    INTO v_expense_count
    FROM expenses
    WHERE trip_id = v_trip;

    PERFORM pg_temp.test_assert(
        'Удаление поездки каскадно удаляет trip_days',
        v_day_count = 0
    );

    PERFORM pg_temp.test_assert(
        'Удаление поездки каскадно удаляет places',
        v_place_count = 0
    );

    PERFORM pg_temp.test_assert(
        'Удаление поездки каскадно удаляет expenses',
        v_expense_count = 0
    );
END;
$$;


-- ============================================================
-- 11. DELETE USER
-- ============================================================

DO $$
DECLARE
    v_user UUID;
    v_session_count INTEGER;
    v_attempt_user UUID;
BEGIN
    SELECT user_id
    INTO v_user
    FROM test_context
    LIMIT 1;

    DELETE FROM users
    WHERE id = v_user;

    SELECT COUNT(*)
    INTO v_session_count
    FROM sessions
    WHERE user_id = v_user;

    SELECT user_id
    INTO v_attempt_user
    FROM login_attempts
    WHERE login_key_hash = decode(repeat('11', 32), 'hex')
    ORDER BY id DESC
    LIMIT 1;

    PERFORM pg_temp.test_assert(
        'Удаление пользователя каскадно удаляет sessions',
        v_session_count = 0
    );

    PERFORM pg_temp.test_assert(
        'При удалении пользователя login_attempts.user_id становится NULL',
        v_attempt_user IS NULL
    );

EXCEPTION
    WHEN OTHERS THEN
        PERFORM pg_temp.test_assert(
            'Удаление пользователя после удаления его поездок',
            FALSE,
            SQLSTATE || ': ' || SQLERRM
        );
END;
$$;


-- ============================================================
-- 12. STRUCTURAL OBJECTS
-- ============================================================

SELECT pg_temp.test_assert(
    'Созданы все 4 updated_at trigger',
    (
        SELECT COUNT(*) = 4
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
          AND trigger_name IN (
              'trg_users_updated_at',
              'trg_trips_updated_at',
              'trg_places_updated_at',
              'trg_expenses_updated_at'
          )
    )
);


SELECT pg_temp.test_assert(
    'Индекс uq_users_email_lower существует',
    EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'uq_users_email_lower'
    )
);


SELECT pg_temp.test_assert(
    'Индекс brute-force по IP существует',
    EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_failed_login_ip'
    )
);


SELECT pg_temp.test_assert(
    'Индекс brute-force по аккаунту существует',
    EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'idx_failed_login_account'
    )
);


-- ============================================================
-- FINAL CLEANUP
-- ============================================================

DELETE FROM login_attempts
WHERE login_key_hash = decode(repeat('11', 32), 'hex');

DELETE FROM trips
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE LOWER(email) = 'dbtest@routea.test'
);

DELETE FROM users
WHERE LOWER(email) = 'dbtest@routea.test';


-- ============================================================
-- RESULTS
-- ============================================================

SELECT
    id,
    CASE
        WHEN passed THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    test_name,
    details
FROM test_results
ORDER BY id;


SELECT
    COUNT(*) AS total_tests,
    COUNT(*) FILTER (WHERE passed) AS passed,
    COUNT(*) FILTER (WHERE NOT passed) AS failed
FROM test_results;