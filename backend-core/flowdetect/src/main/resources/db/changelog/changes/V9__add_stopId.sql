-- 1. Добавляем поля (nullable, чтобы не ломать существующие данные)
ALTER TABLE stops_history 
ADD COLUMN IF NOT EXISTS stop_id BIGINT,
ADD COLUMN IF NOT EXISTS lat DECIMAL(9, 6),
ADD COLUMN IF NOT EXISTS lng DECIMAL(9, 6);

-- 2. Индексы для ускорения поиска и джойнов
CREATE INDEX IF NOT EXISTS idx_stops_history_stop_id ON stops_history(stop_id);
CREATE INDEX IF NOT EXISTS idx_stops_history_coords ON stops_history(lat, lng);

-- 3. (Опционально) Внешний ключ. Раскомментируйте, когда будете уверены в чистоте данных
-- ALTER TABLE stops_history 
-- ADD CONSTRAINT fk_stops_history_stop FOREIGN KEY (stop_id) REFERENCES stops(id);

-- 4. (Опционально) Заполнить существующие исторические данные координатами из stops
UPDATE stops_history sh
SET stop_id = s.id,
    lat = s.lat,
    lng = s.lng
FROM stops s
WHERE sh.address = s.address 
  AND sh.city_id = s.city_id
  AND sh.stop_id IS NULL;