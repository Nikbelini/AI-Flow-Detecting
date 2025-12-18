-- Добавление новых остановок для Ульяновска

-- Минаева 1
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/1376e7dd864af96d/stream.m3u8', 'г.Ульяновск, ул. Минаева 1', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.307815, 48.379345);

-- Октябрьская 17 (Октябрьская - Западный бульвар)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/3dd14bcd3e7e5add/stream.m3u8', 'г.Ульяновск, ул. Октябрьская 17', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.298744, 48.322823);

-- Б. Хмельницкого 35 (парк "Молодежный")
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/24c3036fe19a150a/stream.m3u8', 'г.Ульяновск, ул. Б. Хмельницкого 35', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.287149, 48.307479);

-- Промышленная 84
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/b65d45e5d21e821c/stream.m3u8', 'г.Ульяновск, ул. Промышленная 84', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.280627, 48.312465);

-- Рябикова 61 (Перекресток Камышинская - Рябикова)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/897d7d76ea8555f7/stream.m3u8', 'г.Ульяновск, ул. Рябикова 61', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.275265, 48.291144);

-- Отрадная 46 (Перекресток Самарской-Отрадной)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/6d4fe01052354fc3/stream.m3u8', 'г.Ульяновск, ул. Отрадная 46', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.275365, 48.291041);

-- Перекресток-Локомотивная-Инзенская
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/6b0f2d0f8815b818/stream.m3u8', 'г.Ульяновск, Перекресток Локомотивная-Инзенская', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.265700, 48.318611);

-- Камышинская 27 (Перекресток ул. Самарской- ул.Камышинской)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/6d4fe01052354fc3/stream.m3u8', 'г.Ульяновск, ул. Камышинская 27', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.274066, 48.295909);

-- Рябикова 72
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/451c640d7537e010/stream.m3u8', 'г.Ульяновск, ул. Рябикова 72', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.275472, 48.289961);

-- пр-т Нариманова 71
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/849876ea7110317f/stream.m3u8', 'г.Ульяновск, пр-т Нариманова 71', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.352376, 48.362360);

-- пр-т Нариманова 38
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/c28b84ec671fa5da/stream.m3u8', 'г.Ульяновск, пр-т Нариманова 38', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.337264, 48.382101);

-- Кирова 1 (Кольцо на Кирова 1) - возможно дубль, оставил твой URL
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/06b8a8caca89c5e2/stream.m3u8', 'г.Ульяновск, ул. Кирова 1 (кольцо)', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.305000, 48.388656);

-- Спасская 17
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/9de401caaaa0a46c/stream.m3u8', 'г.Ульяновск, ул. Спасская 17', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.318789, 48.403456);

-- Железная Дивизия 8
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/9a9925e405a8cce4/stream.m3u8', 'г.Ульяновск, ул. Железной Дивизии 8', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.309452, 48.388478);

-- Локомотивная депо
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    ('https://restreamer.vms.evo73.ru/1a054292cc686ea3/stream.m3u8', 'г.Ульяновск, ул. Локомотивная (депо)', 1, 1, 1,
     (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.292973, 48.372441);

-- Остановки без URL (со значением NULL)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng) VALUES
    (NULL, 'г.Ульяновск, ул. Гончарова 10', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.311040, 48.396817),
    (NULL, 'г.Ульяновск, ул. Гончарова 18', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.313635, 48.396386),
    (NULL, 'г.Ульяновск, ул. Радищева 102', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.332098, 48.401219),
    (NULL, 'г.Ульяновск, ул. Кирова 59', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.298280, 48.380333),
    (NULL, 'г.Ульяновск, ул. Луначарского 17', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.263823, 48.333072),
    (NULL, 'г.Ульяновск, пр-т Гая 25А', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.264060, 48.326470),
    (NULL, 'г.Ульяновск, ул. Камышинская 19Г', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.271101, 48.302539);
    (NULL, 'г.Ульяновск, ул. Рябикова, 47В', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.278182, 48.294319);
    (NULL, 'г.Ульяновск, ул. Пушкарёва, 44Б', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.315122, 48.356133);
    (NULL, 'г.Ульяновск, ул. Врача Михайлова 64', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.353155, 48.527450);
    (NULL, 'г.Ульяновск, пр-т. Генерала Тюленева, 16А', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Ульяновск'), 54.380144, 48.589838);



-- Добавление исторических записей для всех новых остановок
INSERT INTO stops_history (city_id, address, count, velocity, load, datetime)
SELECT city_id, address, count, velocity, load, NOW() - INTERVAL '1 minute' FROM stops 
WHERE city_id = (SELECT id FROM cities WHERE name = 'Ульяновск') 
AND address IN (
    'г.Ульяновск, ул. Минаева 1',
    'г.Ульяновск, ул. Октябрьская 17',
    'г.Ульяновск, ул. Б. Хмельницкого 35',
    'г.Ульяновск, ул. Промышленная 84',
    'г.Ульяновск, ул. Рябикова 61',
    'г.Ульяновск, ул. Отрадная 46',
    'г.Ульяновск, Перекресток Локомотивная-Инзенская',
    'г.Ульяновск, ул. Камышинская 27',
    'г.Ульяновск, ул. Рябикова 72',
    'г.Ульяновск, пр-т Нариманова 71',
    'г.Ульяновск, пр-т Нариманова 38',
    'г.Ульяновск, ул. Кирова 1 (кольцо)',
    'г.Ульяновск, ул. Спасская 17',
    'г.Ульяновск, ул. Железной Дивизии 8',
    'г.Ульяновск, ул. Локомотивная (депо)',
    'г.Ульяновск, ул. Гончарова 10',
    'г.Ульяновск, ул. Гончарова 18',
    'г.Ульяновск, ул. Радищева 102',
    'г.Ульяновск, ул. Кирова 59',
    'г.Ульяновск, ул. Луначарского 17',
    'г.Ульяновск, пр-т Гая 25А',
    'г.Ульяновск, ул. Камышинская 19Г'
);
