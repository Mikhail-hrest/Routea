BEGIN;

INSERT INTO expense_categories (id, code, name)
VALUES
    (1, 'TRANSPORT',     'Транспорт'),
    (2, 'ACCOMMODATION', 'Проживание'),
    (3, 'FOOD',          'Питание'),
    (4, 'ENTERTAINMENT', 'Развлечения'),
    (5, 'SHOPPING',      'Покупки'),
    (6, 'OTHER',         'Прочее')
ON CONFLICT (id) DO UPDATE
SET
    code = EXCLUDED.code,
    name = EXCLUDED.name;

COMMIT;