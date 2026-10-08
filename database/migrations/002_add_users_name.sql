BEGIN;

ALTER TABLE users
ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT 'Пользователь';

ALTER TABLE users
ALTER COLUMN name DROP DEFAULT;

ALTER TABLE users
ADD CONSTRAINT chk_users_name_not_empty
CHECK (btrim(name) <> '');

COMMIT;