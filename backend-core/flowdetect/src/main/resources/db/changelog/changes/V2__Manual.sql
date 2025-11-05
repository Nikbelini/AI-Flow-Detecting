-- Добавление Ульяновска
INSERT INTO cities (name, lat, lng) VALUES
    ('Ульяновск', 54.3, 48.3);

-- Добавление тестовых остановок
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
                                                                               ('https://restreamer.vms.evo73.ru/918335436b92ac26/stream.m3u8', 'г.Ульяновск, ул.Гончарова 19', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.318226, 48.396496),

                                                                               ('https://restreamer.vms.evo73.ru/06b8a8caca89c5e2/stream.m3u8', 'г.Ульяновск, ул.Кирова 1', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.304821, 48.388867),

                                                                               ('https://restreamer.vms.evo73.ru/6b0f2d0f8815b818/stream.m3u8', 'г.Ульяновск, ул. Рябикова 3', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.291732, 48.314289),

                                                                               ('https://restreamer.vms.evo73.ru/dfc58bea11e072b4/stream.m3u8', 'г.Ульяновск, ул. Юности 2', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.353780, 48.363624);

-- Добавление исторических записей для каждой остановки (по 2 записи)
-- Для ул.Гончарова 19
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime) VALUES
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул.Гончарова 19', 1, 1, 1, NOW() - INTERVAL '1 minute'),
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул.Гончарова 19', 1, 1, 1, NOW());

-- Для ул. Юности 2
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime) VALUES
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул. Юности 2', 1, 1, 1, NOW() - INTERVAL '1 minute'),
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул. Юности 2', 1, 1, 1, NOW());

-- Добавление исторических записей для ул.Кирова 1
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime) VALUES
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул.Кирова 1', 1, 1, 1, NOW() - INTERVAL '1 minute'),
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул.Кирова 1', 1, 1, 1, NOW());

-- Добавление исторических записей для ул. Рябикова 3
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime) VALUES
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул. Рябикова 3', 1, 1, 1, NOW() - INTERVAL '1 minute'),
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'г.Ульяновск, ул. Рябикова 3', 1, 1, 1, NOW());