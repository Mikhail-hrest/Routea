# Локальный запуск Routea через Docker

Эти файлы добавляют отдельный локальный Docker-запуск и не изменяют существующий Python-код или исходный `compose.yaml`.

## Требования

- Docker Desktop для Windows;
- свободные порты `8000` и `5432`.

## Запуск

Из корня проекта `Routea`:

```powershell
docker compose -f compose.local.yaml up --build
```

После запуска:

- API: <http://127.0.0.1:8000>
- Swagger: <http://127.0.0.1:8000/docs>
- Healthcheck: <http://127.0.0.1:8000/api/v1/health>
- PostgreSQL: `localhost:5432`

Frontend запускается отдельно:

```powershell
cd froont
npm.cmd run dev
```

## Остановка

```powershell
docker compose -f compose.local.yaml down
```

Данные PostgreSQL сохраняются в именованном volume `routea-local_routea_postgres_data`.

Полная остановка с удалением локальной базы данных:

```powershell
docker compose -f compose.local.yaml down --volumes
```

Команда с `--volumes` необратимо удаляет локальные данные PostgreSQL.

## Переменные окружения

В `compose.local.yaml` есть безопасные только для локальной разработки значения по умолчанию. Для своих значений скопируйте `docker.local.env.example` в `.env.docker.local` и запускайте:

```powershell
docker compose --env-file .env.docker.local -f compose.local.yaml up --build
```

Не добавляйте `.env.docker.local` в Git.

## Первая инициализация БД

При первом создании volume PostgreSQL автоматически выполняет существующие файлы:

1. `database/migrations/001_initial.sql`;
2. `database/migrations/002_add_users_name.sql`;
3. `database/seeds/001_expense_categories.sql`.

SQL-скрипты из `docker-entrypoint-initdb.d` выполняются только при создании пустого volume. Если миграции изменились и нужно пересоздать локальную тестовую БД, сначала явно удалите volume командой из раздела выше.

## Проверка состояния

```powershell
docker compose -f compose.local.yaml ps
docker compose -f compose.local.yaml logs -f backend
docker compose -f compose.local.yaml logs -f database
```

## Важно для frontend

Docker запускает API по адресу `http://127.0.0.1:8000`. Для запросов из браузера backend также должен разрешать origin frontend (`http://localhost:5173`) через CORS. Docker не заменяет настройку CORS в FastAPI.
