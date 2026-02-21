-- liquibase formatted sql

-- changeset yourname:1-add-ulyanovsk-city
INSERT INTO cities (name, lat, lng) VALUES
    ('Ульяновск', 54.3, 48.3);

-- changeset yourname:2-add-ulyanovsk-stops
-- Добавление тестовых остановок
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
                                                                               ('https://restreamer.vms.evo73.ru/918335436b92ac26/stream.m3u8', 'Гончарова 19', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.318226, 48.396496),
                                                                               ('https://restreamer.vms.evo73.ru/dfc58bea11e072b4/stream.m3u8', 'Юности 2', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.353780, 48.363624);

-- Добавление исторических записей для каждой остановки
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime) VALUES
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'Гончарова 19', 1, 1, 1, NOW() - INTERVAL '1 minute'),
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'Гончарова 19', 1, 1, 1, NOW()),
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'Юности 2', 1, 1, 1, NOW() - INTERVAL '1 minute'),
                                                                                  ((SELECT id FROM cities WHERE name = 'Ульяновск'), 'Юности 2', 1, 1, 1, NOW());

-- Добавление новых остановок для Ульяновска (с сокращенными адресами)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
                                                                               ('https://restreamer.vms.evo73.ru/1376e7dd864af96d/stream.m3u8', 'Минаева 1', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.307815, 48.379345),
                                                                               ('https://restreamer.vms.evo73.ru/3dd14bcd3e7e5add/stream.m3u8', 'Октябрьская 17', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.298744, 48.322823),
                                                                               ('https://restreamer.vms.evo73.ru/24c3036fe19a150a/stream.m3u8', 'Б.Хмельницкого 35', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.287149, 48.307479),
                                                                               ('https://restreamer.vms.evo73.ru/b65d45e5d21e821c/stream.m3u8', 'Промышленная 84', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.280627, 48.312465),
                                                                               ('https://restreamer.vms.evo73.ru/897d7d76ea8555f7/stream.m3u8', 'Рябикова 61', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.275265, 48.291144),
                                                                               ('https://restreamer.vms.evo73.ru/6d4fe01052354fc3/stream.m3u8', 'Отрадная 46', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.275365, 48.291041),
                                                                               ('https://restreamer.vms.evo73.ru/6b0f2d0f8815b818/stream.m3u8', 'Локомотивная-Инзенская', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.265700, 48.318611),
                                                                               ('https://restreamer.vms.evo73.ru/6d4fe01052354fc3/stream.m3u8', 'Камышинская 27', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.274066, 48.295909),
                                                                               ('https://restreamer.vms.evo73.ru/451c640d7537e010/stream.m3u8', 'Рябикова 72', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.275472, 48.289961),
                                                                               ('https://restreamer.vms.evo73.ru/849876ea7110317f/stream.m3u8', 'Нариманова 71', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.352376, 48.362360),
                                                                               ('https://restreamer.vms.evo73.ru/c28b84ec671fa5da/stream.m3u8', 'Нариманова 38', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.337264, 48.382101),
                                                                               ('https://restreamer.vms.evo73.ru/06b8a8caca89c5e2/stream.m3u8', 'Кирова 1 (кольцо)', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.305000, 48.388656),
                                                                               ('https://restreamer.vms.evo73.ru/9de401caaaa0a46c/stream.m3u8', 'Спасская 17', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.318789, 48.403456),
                                                                               ('https://restreamer.vms.evo73.ru/9a9925e405a8cce4/stream.m3u8', 'Железной Дивизии 8', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.309452, 48.388478),
                                                                               ('https://restreamer.vms.evo73.ru/1a054292cc686ea3/stream.m3u8', 'Локомотивная (депо)', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.292973, 48.372441),
                                                                               -- Остановки без URL
                                                                               ('', 'Гончарова 10', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.311040, 48.396817),
                                                                               ('', 'Гончарова 18', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.313635, 48.396386),
                                                                               ('', 'Радищева 102', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.332098, 48.401219),
                                                                               ('', 'Кирова 59', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.298280, 48.380333),
                                                                               ('', 'Луначарского 17', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.263823, 48.333072),
                                                                               ('', 'Гая 25А', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.264060, 48.326470),
                                                                               ('', 'Камышинская 19Г', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.271101, 48.302539),
                                                                               ('', 'Рябикова 47В', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.278182, 48.294319),
                                                                               ('', 'Пушкарёва 44Б', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.315122, 48.356133),
                                                                               ('', 'Врача Михайлова 64', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.353155, 48.527450),
                                                                               ('', 'Генерала Тюленева 16А', 1, 1, 1,
                                                                                (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.380144, 48.589838);

-- Добавление исторических записей для всех новых остановок
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime)
SELECT city_id, address, count, velocity, load, NOW() - INTERVAL '1 minute'
FROM stops
WHERE city_id = (SELECT id FROM cities WHERE name = 'Ульяновск');