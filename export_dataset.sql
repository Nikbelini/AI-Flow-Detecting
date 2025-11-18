-- Создаем представление для удобного экспорта
CREATE OR REPLACE VIEW passenger_flow_dataset AS
SELECT
    sh.datetime as timestamp,
    sh.address,
    sh.count as passenger_count,
    sh.velocity,
    sh.load,
    c.name as city_name,
    c.lat as city_lat,
    c.lng as city_lng,
    EXTRACT(HOUR FROM sh.datetime) as hour_of_day,
    EXTRACT(DOW FROM sh.datetime) as day_of_week,
    EXTRACT(MONTH FROM sh.datetime) as month,
    w.temperature,
    w.precipitation,
    w.weather_code,
    CASE
        WHEN e.is_holiday THEN 'holiday'
        WHEN e.has_special_event THEN 'special_event'
        ELSE 'normal_day'
END as day_type,
    COALESCE(e.event_type, 'NO_EVENTS') as event_type
FROM stops_history sh
LEFT JOIN cities c ON sh.city_id = c.id
LEFT JOIN weather_data w ON w.city_id = c.id
    AND DATE(w.datetime) = DATE(sh.datetime)
    AND EXTRACT(HOUR FROM w.datetime) = EXTRACT(HOUR FROM sh.datetime)
LEFT JOIN events e ON e.city_id = c.id
    AND e.event_date = DATE(sh.datetime)
ORDER BY sh.datetime, sh.address;

-- Экспортируем данные в CSV
COPY (
SELECT * FROM passenger_flow_dataset
    ) TO '/tmp/passenger_flow_dataset.csv' WITH CSV HEADER DELIMITER ',';