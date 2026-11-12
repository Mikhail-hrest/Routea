-- Idempotent one-time backfill for trips created before server-managed days.
-- The UNIQUE(trip_id, day_date) constraint prevents duplicate dates.
-- Does not modify or remove any existing trip days or places.

INSERT INTO trip_days (trip_id, day_date)
SELECT t.id, d.day_date::date
FROM trips AS t
CROSS JOIN LATERAL generate_series(
    t.start_date::timestamp,
    t.end_date::timestamp,
    interval '1 day'
) AS d(day_date)
ON CONFLICT (trip_id, day_date) DO NOTHING;
