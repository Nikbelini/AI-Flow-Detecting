-- liquibase formatted sql

-- changeset modeling:1-fill-historical-data-fixed
-- comment: Заполнение stops_history реалистичными данными (исправленная версия)

-- Очистка старых данных (опционально)
DELETE FROM stops_history WHERE datetime > NOW() - INTERVAL '100 days';

-- Основная вставка данных за последние 90 дней
WITH
    city_info AS (
        SELECT id AS city_id FROM cities WHERE name = 'Ульяновск'
    ),
    stops_in_city AS (
        SELECT
            s.id,
            s.address,
            CASE
                WHEN s.address LIKE '%Гончарова%' OR s.address LIKE '%Спасская%' OR s.address LIKE '%Железной Дивизии%' THEN 'office'
                WHEN s.address LIKE '%Рябикова%' OR s.address LIKE '%Камышинская%' OR s.address LIKE '%Отрадная%' OR s.address LIKE '%Промышленная%' THEN 'shopping'
                ELSE 'residential'
                END AS stop_type
        FROM stops s
        WHERE s.city_id = (SELECT city_id FROM city_info)
    ),
-- все комбинации остановка × день (90 дней) × час (24)
    all_combinations AS (
        SELECT
            s.id AS stop_id,
            s.address,
            s.stop_type,
            (NOW() - (d.day_offset || ' days')::interval + (h.hour || ' hours')::interval) AS dt
        FROM stops_in_city s
                 CROSS JOIN generate_series(0, 89) AS d(day_offset)
                 CROSS JOIN generate_series(0, 23) AS h(hour)
    ),
-- базовое среднее количество пассажиров (без случайности)
    base_counts AS (
        SELECT
            ac.stop_id,
            ac.address,
            ac.stop_type,
            ac.dt,
            (CASE
                 WHEN ac.stop_type = 'office' THEN
                     CASE
                         WHEN EXTRACT(DOW FROM ac.dt) IN (0,6) THEN 5
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 7 AND 9 THEN 40
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 17 AND 19 THEN 40
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 10 AND 16 THEN 15
                         ELSE 5
                         END
                 WHEN ac.stop_type = 'shopping' THEN
                     CASE
                         WHEN EXTRACT(DOW FROM ac.dt) IN (0,6) AND EXTRACT(HOUR FROM ac.dt) BETWEEN 11 AND 18 THEN 50
                         WHEN EXTRACT(DOW FROM ac.dt) IN (0,6) THEN 10
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 12 AND 15 THEN 30
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 17 AND 19 THEN 30
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 8 AND 11 THEN 15
                         ELSE 5
                         END
                 ELSE -- residential
                     CASE
                         WHEN EXTRACT(DOW FROM ac.dt) IN (0,6) AND EXTRACT(HOUR FROM ac.dt) BETWEEN 10 AND 20 THEN 20
                         WHEN EXTRACT(DOW FROM ac.dt) IN (0,6) THEN 10
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 7 AND 9 THEN 30
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 18 AND 20 THEN 40
                         WHEN EXTRACT(HOUR FROM ac.dt) BETWEEN 10 AND 16 THEN 8
                         ELSE 3
                         END
                END) AS base_count
        FROM all_combinations ac
    )
-- финальная вставка с добавлением случайного разброса
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime)
SELECT
    (SELECT city_id FROM city_info),
    bc.address,
    (bc.base_count + floor(random() * (bc.base_count/2 + 1))::int)::int AS count,
    floor((bc.base_count + floor(random() * (bc.base_count/2 + 1))::int) / 5)::int AS velocity,
    CASE
        WHEN bc.base_count > 40 THEN 7 + floor(random()*3)::int
        WHEN bc.base_count > 20 THEN 4 + floor(random()*3)::int
        ELSE 1 + floor(random()*2)::int
END AS load,
    bc.dt
FROM base_counts bc;

-- Обновление текущих значений в таблице stops на основе последнего часа
UPDATE stops s
SET
    count = COALESCE((
                         SELECT AVG(count)::int
                         FROM stops_history
                         WHERE address = s.address AND datetime > NOW() - INTERVAL '1 hour'
        ), 1),
    velocity = COALESCE((
                            SELECT AVG(velocity)::int
                            FROM stops_history
                            WHERE address = s.address AND datetime > NOW() - INTERVAL '1 hour'
        ), 1),
    load = COALESCE((
                        SELECT AVG(load)::int
                        FROM stops_history
                        WHERE address = s.address AND datetime > NOW() - INTERVAL '1 hour'
        ), 1)
WHERE city_id = (SELECT id FROM cities WHERE name = 'Ульяновск');

-- Индекс для ускорения запросов
CREATE INDEX IF NOT EXISTS idx_stops_history_address_datetime ON stops_history(address, datetime);