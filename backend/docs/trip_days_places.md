# Routea API: дни поездки и места

Модуль работает с **существующими** таблицами `trip_days` и `places` из `database/migrations/001_initial.sql`.
Новая миграция не нужна, если эта миграция уже применена к PostgreSQL.

Все endpoints требуют `Authorization: Bearer <access_token>` и используют `get_current_user`.
Для несуществующих и чужих ресурсов возвращается одинаковый `404`.

## Endpoints

| Метод | Путь (после `/api/v1`) | Назначение |
|---|---|---|
| POST | `/trips/{trip_id}/days` | создать день |
| GET | `/trips/{trip_id}/days` | список дней по датам |
| GET | `/trips/{trip_id}/days/{day_id}` | получить день |
| PATCH | `/trips/{trip_id}/days/{day_id}` | изменить дату |
| DELETE | `/trips/{trip_id}/days/{day_id}` | удалить день и его места |
| POST | `/trips/{trip_id}/days/{day_id}/places` | добавить место в конец дня |
| GET | `/trips/{trip_id}/days/{day_id}/places` | список мест по `position` |
| GET | `/trips/{trip_id}/days/{day_id}/places/{place_id}` | получить место |
| PATCH | `/trips/{trip_id}/days/{day_id}/places/{place_id}` | изменить место (кроме позиции) |
| DELETE | `/trips/{trip_id}/days/{day_id}/places/{place_id}` | удалить место |
| PUT | `/trips/{trip_id}/days/{day_id}/places/order` | задать порядок всех мест дня |

## Swagger: пример последовательности

1. Создайте поездку с диапазоном дат, например `2027-06-01` — `2027-06-07`, и скопируйте `id`.
2. POST `/trips/{trip_id}/days`:

   ```json
   {"day_date":"2027-06-02"}
   ```

   Успех `201`. Скопируйте `id` дня из JSON.
3. POST `/trips/{trip_id}/days/{day_id}/places`:

   ```json
   {"name":"Колизей","address":"Piazza del Colosseo, Roma","planned_time":"10:00:00","note":"Купить билеты заранее"}
   ```

   Успех `201`. `position` будет установлен автоматически (1, 2, 3 …).
4. Добавьте второе место, затем GET `/trips/{trip_id}/days/{day_id}/places`.
5. Чтобы поменять порядок, PUT `/trips/{trip_id}/days/{day_id}/places/order`:

   ```json
   {"place_ids": ["uuid-второго-места", "uuid-первого-места"]}
   ```

   Требуется передать **все** ID мест дня ровно один раз. При изменившемся наборе ID возвращается `409`.
6. Попробуйте POST дня за пределами диапазона поездки → `422`.
7. Попробуйте создать одинаковую дату дважды → `409`.
8. Проверьте ограничения владельца, авторизовавшись вторым аккаунтом → `404`.

## Правила

- Дата дня должна принадлежать включительному диапазону `start_date...end_date` поездки.
- Один день на одну дату в рамках поездки; уникальность гарантирована БД.
- PATCH поездки не может исключить уже добавленные дни из своего интервала.
- У места `position` положительный и уникальный внутри дня. При добавлении выбирается `max(position) + 1`, сериализуя создание по блокировке родительского дня.
- После DELETE позиции могут иметь пробелы (например, 1, 3). PUT `/order` присваивает плотную нумерацию 1..N.
- Удаление `trip_day` каскадно удаляет его `places` согласно существующей схеме.
- `planned_time` — локальное время без часового пояса (PostgreSQL `TIME`), не абсолютный момент времени.

## Установка

1. Скопируйте новые/изменённые файлы в `backend` или примените patch в корне Routea.
2. Убедитесь, что таблицы существуют:
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN ('trip_days', 'places');
   ```
3. `cd backend`, затем `python -m unittest discover -s tests -v`.
4. Запустите FastAPI `python -m uvicorn app.main:app --reload` и проверьте Swagger `/docs`.

**Примечание:** тесты проверяют схемы, бизнес-логику и условия SQL-запросов без живой PostgreSQL. Интеграционные операции в вашей БД нужно проверить через Swagger.
