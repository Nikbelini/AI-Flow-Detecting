-- V2__insert_stops_copeysk_ekb.sql
-- Вставка остановок для Копейска и Екатеринбурга

-- ============================================
-- КОПЕЙСК
-- ============================================
WITH city_copeysk AS (
    SELECT id FROM cities WHERE name = 'Копейск'
),
copeysk_data(url, address, count, velocity, load, lat, lng) AS (
    VALUES
        ('https://hls.insit.ru/camera01-centr-pl_slavy/index.m3u8', 'пл. Трудовой Славы', 1, 1, 1, 55.116995, 61.613025),
        ('https://hls.insit.ru/camera03-centr-administraciya/index.m3u8', 'пл. Красных Партизан', 1, 1, 1, 55.112599, 61.622061),
        ('https://hls.insit.ru/camera04-centr-pobedy/index.m3u8', 'пр. Победы', 1, 1, 1, 55.117701, 61.602318),
        ('https://hls.insit.ru/camera08-centr-skver_kalinina/index.m3u8', 'сквер им. Калинина', 1, 1, 1, 53.215409, 50.254643),
        ('https://hls.insit.ru/camera09-centr-nalogovaya/index.m3u8', 'Налоговая', 1, 1, 1, 55.113705, 61.617975),
        ('https://hls.insit.ru/camera10-centr-kommunisticheskiy_ilyicha/index.m3u8', 'пр. Коммунистический - пр. Ильича', 1, 1, 1, 55.108202, 61.617771),
        ('https://hls.insit.ru/camera11-centr-dk_kirova/index.m3u8', 'ДК Кирова', 1, 1, 1, 55.108445, 61.608564),
        ('https://hls.insit.ru/camera12-centr-skver_pavshih_geroev/index.m3u8', 'сквер павших Героев', 1, 1, 1, 55.113198, 61.624587),
        ('https://hls.insit.ru/camera13-centr-pobedy_sutyagina/index.m3u8', 'пр. Победы - ул. Сутягина', 1, 1, 1, 55.116892, 61.621173),
        ('https://hls.insit.ru/camera15-centr-park_pobedy_velodorogka/index.m3u8', 'Велодорожка (Парк Победы)', 1, 1, 1, 55.117988, 61.594498),
        ('https://hls.insit.ru/camera16-centr-sportschool2/index.m3u8', 'Спортшкола, пер. Свободы', 1, 1, 1, 55.113519, 61.615082),
        ('https://hls.insit.ru/camera17-potanino-skver_dk_ilyicha/index.m3u8', 'сквер в п. Потанино', 1, 1, 1, 55.179781, 61.620197),
        ('https://hls.insit.ru/camera20-bazhovo-dk_bazhova/index.m3u8', 'ДК Бажова', 1, 1, 1, 55.057215, 61.606365)
)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng)
SELECT d.url, d.address, d.count, d.velocity, d.load, c.id, d.lat, d.lng
FROM copeysk_data d
CROSS JOIN city_copeysk c;


-- ============================================
-- ЕКАТЕРИНБУРГ
-- ============================================
WITH city_ekb AS (
    SELECT id FROM cities WHERE name = 'Екатеринбург'
),
ekb_data(url, address, count, velocity, load, lat, lng) AS (
    VALUES
        ('https://video2.interra.ru/glaz.naroda.123-bca74ea03e/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAHPv67KPoIKKpWQjks9sAP8egwBd', 'г. Екатеринбург, перекрёсток Новаторов-Ломоносова', 1, 1, 1, 56.908715, 60.599598),
        ('https://video2.interra.ru/glaz.naroda.115-021d27caba/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAEsmOhMsJ38n5tvsDGjnWBQbg6N_', 'г. Екатеринбург, перекрёсток Коммунистическая - Бакинских комиссаров', 1, 1, 1, 56.909315, 60.593401),
        ('https://video2.interra.ru/glaz.naroda.121-c9e033c05f/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAHTKPf595bILj3OTg5Az34JUkT1F', 'г. Екатеринбург, перекрёсток Ломоносова-Коммунистическая', 1, 1, 1, 56.905645, 60.595920),
        ('https://video2.interra.ru/glaz.naroda.145-d9fae6233d/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAADfGYmxR2TjWernO6iwuG4P4Mycx', 'г. Екатеринбург, перекрёсток Шефская-Совхозная', 1, 1, 1, 56.907770, 60.620361),
        ('https://video2.interra.ru/glaz.naroda.124-b99b1c006b/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAHhCJ7yue3rhcd4I9U1D_m65alvJ', 'г. Екатеринбург, перекрёсток Восстания-Ломоносова', 1, 1, 1, 56.905609, 60.595952),
        ('https://video2.interra.ru/glaz.naroda.106-95a9721714/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAO3XpFjv2anisyiCrapZLkJ8tHWu', 'г. Екатеринбург, перекрёсток Восстания - 40 лет Октября', 1, 1, 1, 56.904275, 60.599263),
        ('https://video2.interra.ru/glaz.naroda.126-b166cc2da0/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAIzuAQWCJ-9MSkEl6S3TDdNvI5Q1', 'г. Екатеринбург, перекрёсток Стахановская-Восстания', 1, 1, 1, 56.901283, 60.607069),
        ('https://video2.interra.ru/glaz.naroda.112-dea00a5e37/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAPASQXYIWbtJQP53vHF_eoWlKNLd', 'г. Екатеринбург, перекрёсток Ильича-Восстания', 1, 1, 1, 56.899871, 60.610635),
        ('https://video2.interra.ru/glaz.naroda.141-62f302c490/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAALOo7dG8Ci_XC7JSXEfXdPQS7cws', 'г. Екатеринбург, перекрёсток Ильича - Космонавтов - Старых Большевиков', 1, 1, 1, 56.900680, 60.613270),
        ('https://video2.interra.ru/glaz.naroda.138-4238e06058/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAACkR8qZe2YM1PD4RVeyAkZtXIzPu', 'г. Екатеринбург, перекрёсток Старых Большевиков - Фрезеровщиков', 1, 1, 1, 56.900867, 60.619804),
        ('https://video2.interra.ru/glaz.naroda.144-585d3d9140/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAH4DAFi19j8AOqeZIQujPEALKYhp', 'г. Екатеринбург, перекрёсток Таганская-Фрезеровщиков', 1, 1, 1, 56.905312, 60.631770),
        ('https://video2.interra.ru/glaz.naroda.131-da5db808c2/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAG5Fz73LuyvWPQaVCSsEh9TRq4XZ', 'г. Екатеринбург, перекрёсток Космонавтов-Войкова', 1, 1, 1, 56.894769, 60.614532),
        ('https://video2.interra.ru/glaz.naroda.143-9a8b42a16c/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAGuhEUp4gwQfK_8sZVyIWxAwXWU3', 'г. Екатеринбург, перекрёсток Стачек-Войкова', 1, 1, 1, 56.896230, 60.619014),
        ('https://video2.interra.ru/glaz.naroda.139-6137e20176/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAACgMC9oDBhJswrCmh8y-omM_cLx-', 'г. Екатеринбург, перекрёсток Старых Большевиков - Войкова', 1, 1, 1, 56.897671, 60.622867),
        ('https://video2.interra.ru/glaz.naroda.142-b10362fa6b/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAABDcPXy-Do19A_HsAsOONZZtUOYn', 'г. Екатеринбург, перекрёсток Шефская-Войкова', 1, 1, 1, 56.899398, 60.628402),
        ('https://video2.interra.ru/glaz.naroda.150-4bc2c5fe83/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAH_KShg0rQDzdA8Kpz1aPEgAyXxw', 'г. Екатеринбург, перекрёсток Баумана - Старых большевиков', 1, 1, 1, 56.891888, 60.629366),
        ('https://video2.interra.ru/glaz.naroda.151-10f8e278b9/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAACQE71EpSrcH1-oUsrSC7zpT2KmC', 'г. Екатеринбург, перекрёсток Старых большевиков - Краснофлотцев', 1, 1, 1, 56.889769, 60.632136),
        ('https://video2.interra.ru/glaz.naroda.155-8c2b86b847/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAKLygmlD0vpC9S_IDgfSLh37uSgB', 'г. Екатеринбург, перекрёсток Старых Большевиков-Корепина', 1, 1, 1, 56.889098, 60.633171),
        ('https://video2.interra.ru/glaz.naroda.102-3c97eb6767/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAEyXWLqtwoGawRMJVZ2avzsVqYy7', 'г. Екатеринбург, перекрёсток Победы - Бакинских комиссаров', 1, 1, 1, 56.903798, 60.586795),
        ('https://video2.interra.ru/glaz.naroda.101-6ecb4aa047/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAJBm247LYhmZJDmRzOQ5knrnqIC0', 'г. Екатеринбург, перекрёсток Победы-Ломоносова', 1, 1, 1, 56.902402, 60.590658),
        ('https://video2.interra.ru/glaz.naroda.135-db2f6847c3/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAPohFV-xDN6Ag58tiUHXPmJVFUze', 'г. Екатеринбург, перекрёсток Победы - 40 лет Октября', 1, 1, 1, 56.900567, 60.595071),
        ('https://video2.interra.ru/glaz.naroda.103-ea7a4cf93b/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAImjREzad6ct3QpaSmG-Y1nxOF4q', 'г. Екатеринбург, перекрёсток Победы-Индустрии', 1, 1, 1, 56.899129, 60.598822),
        ('https://video2.interra.ru/glaz.naroda.132-18b2fae939/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAIQwaC__ntBv9lZde0ejF14iSPE5', 'г. Екатеринбург, перекрёсток Победы-Ильича', 1, 1, 1, 56.896052, 60.606832),
        ('https://video2.interra.ru/glaz.naroda.122-e606ba3475/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAA6V5Lu8QW7_RRt4iJwe4NVURYHk', 'г. Екатеринбург, сквер имени Льва Люльева', 1, 1, 1, 56.893238, 60.613466),
        ('https://video2.interra.ru/glaz.naroda.113-9be8bef91d/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAALUqkp2yyH73BzG0BHmbelU0_JBx', 'г. Екатеринбург, перекрёсток Победы-Космонавтов', 1, 1, 1, 56.893157, 60.613418),
        ('https://video2.interra.ru/glaz.naroda.116-4a319df9ad/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAABVt2wtybaJRJnke8rg_HC3dIGWi', 'г. Екатеринбург, перекрёсток Стахановская - Уральских рабочих', 1, 1, 1, 56.895643, 60.599732),
        ('https://video2.interra.ru/glaz.naroda.108-a54d7c4cfe/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAABID_6GpQII_vZ4qBFbLhZjAuEEy', 'г. Екатеринбург, перекрёсток Ильича - Уральских рабочих', 1, 1, 1, 56.894137, 60.603664),
        ('https://video2.interra.ru/glaz.naroda.118-8a2eb9738a/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAANDeD_1JuUiz_Yw3uXDTfPMRYzWm', 'г. Екатеринбург, перекрёсток Калинина-Стахановская', 1, 1, 1, 56.893541, 60.597038),
        ('https://video2.interra.ru/glaz.naroda.110-b35df3a6f3/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAAjsdfwmpjTMcQmKreYIRwF06k1i', 'г. Екатеринбург, перекрёсток Ильича-Калинина', 1, 1, 1, 56.892066, 60.600941),
        ('https://video2.interra.ru/glaz.naroda.119-2b4f3189a6/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAI3uP3SwHDc1lDRN2eTJEVPVX66Q', 'г. Екатеринбург, перекрёсток Калинина - Красных борцов', 1, 1, 1, 56.891338, 60.602764),
        ('https://video2.interra.ru/glaz.naroda.129-b35b3bb956/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAANgkrrtdfetSrwhK-pXIzWD-4pub', 'г. Екатеринбург, перекресток Кировградская - 40 лет Октября - Фестивальная', 1, 1, 1, 56.894629, 60.586890),
        ('https://video2.interra.ru/glaz.naroda.114-00c6b9cccc/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAO_c5Z6w7LvYWafNIX30AyN6wcjT', 'г. Екатеринбург, перекрёсток Кировградская-Орджоникидзе', 1, 1, 1, 56.893122, 60.590306),
        ('https://video2.interra.ru/glaz.naroda.125-407cff734e/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAIfzIZ3yabwV2RWSlhrgFfo06EMp', 'г. Екатеринбург, перекрёсток Ильича-Кировградская', 1, 1, 1, 56.890113, 60.598561),
        ('https://video2.interra.ru/glaz.naroda.140-350493179a/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAI-xsldRH0S2LM6c1zLkcBwG-fXp', 'г. Екатеринбург, перекрёсток Таганская-Краснофлотцев', 1, 1, 1, 56.896070, 60.642399),
        ('https://video2.interra.ru/glaz.naroda.130-6d66894200/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAALdJ-O9va4AOJuVLIFaFVRBILeih', 'г. Екатеринбург, перекресток Орджоникидзе - Красных партизан - Дружбы', 1, 1, 1, 56.890526, 60.590649),
        ('https://video2.interra.ru/glaz.naroda.137-24b2698e75/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAHgOjXKDyRd852IklMIJ8G1ib_Dk', 'г. Екатеринбург, ул. Фестивальная, СГО Дворец народного творчества', 1, 1, 1, 56.891254, 60.579455),
        ('https://video2.interra.ru/glaz.naroda.136-bab0b9f6a6/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAEGEQRGuqobs6i4rWr5lo6vDcJyv', 'г. Екатеринбург, перекрёсток Культуры - 40 лет Октября', 1, 1, 1, 56.890293, 60.581515),
        ('https://video2.interra.ru/glaz.naroda.120-3d4dca67d5/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAADx6xjcNACYf7jJBpDcZsibdUqz3', 'г. Екатеринбург, перекрёсток Донбасская - 22 партсъезда', 1, 1, 1, 56.890513, 60.569411),
        ('https://video2.interra.ru/glaz.naroda.128-0d7b2d2867/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAJW2kv1Ovhjy7IOYANd4WdGStdzH', 'г. Екатеринбург, перекресток Донбасская-Черниговский', 1, 1, 1, 56.888005, 60.566519),
        ('https://video2.interra.ru/glaz.naroda.104-1c924f6654/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAN2gcupubO9xDpU6oGa3Ru0QYy3l', 'г. Екатеринбург, перекрёсток Донбасская-Суворовский', 1, 1, 1, 56.885755, 60.563022),
        ('https://video2.interra.ru/glaz.naroda.111-da1d972e51/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAGPAt_ZgOTtWxYY1Q-ubAUHYRzPZ', 'г. Екатеринбург, перекрёсток Донбасская-Машиностроителей', 1, 1, 1, 56.884046, 60.562330),
        ('https://video2.interra.ru/glaz.naroda.109-f9451b288c/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAANXkeit71cNxT4L_ABUy9qPsUKU5', 'г. Екатеринбург, перекрёсток Машиностроителей - 40 лет Октября', 1, 1, 1, 56.884810, 60.576341),
        ('https://video2.interra.ru/glaz.naroda.134-9fdb66df07/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAAQXLzeZslivwoJ2T0pixKPsKGz0', 'г. Екатеринбург, перекрёсток Донбасская-Никольский', 1, 1, 1, 56.880223, 60.558196),
        ('https://video2.interra.ru/glaz.naroda.148-3db964845e/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAGrLZJJ6vtGNDUeaqJwCcWVLbgsH', 'г. Екатеринбург, перекрёсток Бебеля-Автомагистральная', 1, 1, 1, 56.875582, 60.553643),
        ('https://video2.interra.ru/glaz.naroda.147-e63430a1e6/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAA9LDyHSjdl6MfTs8qoe-QRfb6Qn', 'г. Екатеринбург, перекрёсток Бебеля-Пехотинцев', 1, 1, 1, 56.870571, 60.549205),
        ('https://video2.interra.ru/glaz.naroda.154-feb4bc711e/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAAXb09brtNdhSJxyrEZp_1GDQbFj', 'г. Екатеринбург, перекрёсток Бебеля-Теплоходный', 1, 1, 1, 56.870238, 60.551233),
        ('https://video2.interra.ru/glaz.naroda.153-d3ffc0ea33/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAJPpcd-u3GieeWexG5kHmuapEhV_', 'г. Екатеринбург, перекрёсток Техническая-Ватутина-Соликамская', 1, 1, 1, 56.871017, 60.520535),
        ('https://video2.interra.ru/glaz.naroda.152-cd49909f0a/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAO4B8N3ySInKLobdKm7EyXw9nMBm', 'г. Екатеринбург, перекрёсток Техническая-Сортировочная', 1, 1, 1, 56.868756, 60.526245),
        ('https://video2.interra.ru/glaz.naroda.146-4be9be3de1/index.m3u8?token=3.9CzUU5u-AAAAAAAAAEsAAAAAAAAAAISvwrAOs1t3BW9skJJlW-TPc3EQ', 'г. Екатеринбург, перекрёсток Таватуйская-Теплоходный', 1, 1, 1, 56.867457, 60.545215)
)
INSERT INTO stops (url, address, count, velocity, load, city_id, lat, lng)
SELECT d.url, d.address, d.count, d.velocity, d.load, c.id, d.lat, d.lng
FROM ekb_data d
CROSS JOIN city_ekb c;

    -- ('https://hls.insit.ru/camera23-oktyabrskiy-premyera17/index.m3u8', 'мкр-н Премьера, д.17.', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1334, 61.6389),
    -- ('https://hls.insit.ru/camera24-starokamyshinsk-ploshad/index.m3u8', 'пос. Старокамышинск. Площадь', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1567, 61.5456),
    -- ('https://hls.insit.ru/camera25-centr-kommunisticheskiy/index.m3u8', 'пр. Коммунистический, 22', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1178, 61.6145),
    -- ('https://hls.insit.ru/camera26-oktyabrskiy-lenina17_dvor/index.m3u8', 'Двор Ленина 17', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1367, 61.6378),
    -- ('https://hls.insit.ru/camera27-oktyabdskiy-lenina17_hockeybox/index.m3u8', 'пос. Октябрьский, Хоккейная коробка', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1378, 61.6356),
    -- ('https://hls.insit.ru/camera28-oktyabrskiy-severnaya23a/index.m3u8', 'Северная 23а', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1389, 61.6334),
    -- ('https://hls.insit.ru/camera29-oktyabrskiy-26Partsyezda1/index.m3u8', 'пос. Октябрьский, ул. 26 Партсъезда, 1', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1345, 61.6389),
    -- ('https://hls.insit.ru/camera30-oktyabrskiy-lenina8b/index.m3u8', 'Двор Ленина 8б', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1356, 61.6367),
    -- ('https://hls.insit.ru/camera31-oktyabrskiy-ploshadka_malahitovaya20/index.m3u8', 'пос. Октябрьский, ул. Малахитовая', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1334, 61.6401),
    -- ('https://hls.insit.ru/camera32-oktyabrskiy-ploshadka_malahitovaya20/index.m3u8', 'пос. Октябрьский, ул. Малахитовая', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1323, 61.6412),
    -- ('https://hls.insit.ru/camera33-oktyabrskiy-rossiyskaya8/index.m3u8', 'пос. Октябрьский, ул. Российская - ул. 26-го Партсъезда', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1367, 61.6345),
    -- ('https://hls.insit.ru/camera34-oktyabrskiy-skver_molodegnaya8/index.m3u8', 'Сквер, Молодежная 8', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1378, 61.6323),
    -- ('https://hls.insit.ru/camera35-oktyabrskiy-lenina13/index.m3u8', 'пос. Октябрьский, ул. Ленина - ул. Молодежная', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1389, 61.6312),
    -- ('https://hls.insit.ru/camera36-oktyabrskiy-rossiyskaya6_dvor/index.m3u8', 'Двор Российская 6', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1345, 61.6356),
    -- ('https://hls.insit.ru/camera37-oktyabrskiy-gagarina14_peshehodnik/index.m3u8', 'Пешеходный переход', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1356, 61.6378),
    -- ('https://hls.insit.ru/camera38-kalachevo-ploshadka/index.m3u8', 'с.Калачево. Д.К. им. Маяковского', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.0789, 61.5234),
    -- ('https://hls.insit.ru/camera39-center-kommunisticheskiy/index.m3u8', 'пр. Коммунистический, 18', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1189, 61.6134),
    -- ('https://hls.insit.ru/camera40-center-kommunisticheskiy/index.m3u8', 'пр. Коммунистический, 12', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1201, 61.6123),
    -- ('https://hls.insit.ru/camera41-center-kuznecova_borby/index.m3u8', 'ул. Борьбы - ул. Кузнецова', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1212, 61.6112),
    -- ('https://hls.insit.ru/camera42-center-pobedy_hohryakova/index.m3u8', 'пр. Победы - ул. Хохрякова', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1223, 61.6101),
    -- ('https://hls.insit.ru/camera44-center-skver_temnika/index.m3u8', 'сквер Темника', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1234, 61.6089),
    -- ('https://hls.insit.ru/camera45-center-skver_temnika/index.m3u8', 'сквер Темника', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1245, 61.6078),
    -- ('https://hls.insit.ru/camera46-bagova-skver/index.m3u8', 'сквер Бажова', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1278, 61.6223),
    -- ('https://hls.insit.ru/camera47-bagova-skver/index.m3u8', 'Детская площадка возле ДК Бажова', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1289, 61.6212),
    -- ('https://hls.insit.ru/camera49-center-kniga_pamyati/index.m3u8', 'книга Памяти', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1167, 61.6156),
    -- ('https://hls.insit.ru/camera55-pmz-skver/index.m3u8', 'сквер РМЗ', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1456, 61.5678),
    -- ('https://hls.insit.ru/camera51-center-park-pobedy-parkovka/index.m3u8', 'парк Победы (парковка)', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1156, 61.6078),
    -- ('https://hls.insit.ru/camera52-oktyabrskiy-gagarina_domkult/index.m3u8', 'ДК им. Лермонтова', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1367, 61.6334),
    -- ('https://hls.insit.ru/camera53-centr-pobedy_slavy/index.m3u8', 'пр-кт Победы - пр-кт Славы', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1178, 61.6145),
    -- ('https://hls.insit.ru/camera54-centr-kirova-kalinina/index.m3u8', 'ул. Кирова - ул. Калинина', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1189, 61.6167),
    -- ('https://hls.insit.ru/camera56-starcom-dkmayak/index.m3u8', 'ДК им. Маяковского', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1578, 61.5445),
    -- ('https://hls.insit.ru/camera57-centr-prktslavy/index.m3u8', 'пр. Славы - пр. Ильича', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1201, 61.6134),
    -- ('https://hls.insit.ru/camera58-gornyak-vaganovka/index.m3u8', 'пруд Вагановка', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.0989, 61.6445),
    -- ('https://hls.insit.ru/camera59-centr-prktslavy/index.m3u8', 'пр. Славы, 48 школа', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1212, 61.6123),
    -- ('https://hls.insit.ru/camera60-centr-golca/index.m3u8', 'ул. Гольца. Школа 42', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1223, 61.6112),
    -- ('https://hls.insit.ru/camera61-centr-golca/index.m3u8', 'ул. Гольца. Детская поликлиника', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1234, 61.6101),
    -- ('https://hls.insit.ru/camera62-centr-pobedyslavy/index.m3u8', 'пр-кт Победы - пр-кт Славы', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1189, 61.6134),
    -- ('https://hls.insit.ru/camera63-centr-slavy/index.m3u8', 'пр. Славы, д.31', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1201, 61.6145),
    -- ('https://hls.insit.ru/camera64-centr-kogevnikova/index.m3u8', 'ул. Кожевникова, 7', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1212, 61.6156),
    -- ('https://hls.insit.ru/camera65-centr-cheburechnaya/index.m3u8', 'пр. Победы - ул. Гольца', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1223, 61.6112),
    -- ('https://hls.insit.ru/camera66-centr-skverkalinina/index.m3u8', 'Сквер Калинина', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1167, 61.6178),
    -- ('https://hls.insit.ru/camera67-centr-vokzal/index.m3u8', 'Автовокзал', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1145, 61.6089),
    -- ('https://hls.insit.ru/camera68-starkom-skver/index.m3u8', 'ул. Крымская. Сквер', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1589, 61.5434),
    -- ('https://hls.insit.ru/camera71-centr-pobedy/index.m3u8', 'пр-кт Победы, д.30', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1178, 61.6123),
    -- ('https://hls.insit.ru/camera72-bagova-mira/index.m3u8', 'ул. Мира - ул. Бажова', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1267, 61.6234),
    -- ('https://hls.insit.ru/camera73-potanino-pertoreza/index.m3u8', 'ул. Луганская - пер. Тореза', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1467, 61.5778),
    -- ('https://hls.insit.ru/camera69-centr-borby/index.m3u8', 'ул. Борьбы, д.21', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1189, 61.6145),
    -- ('https://hls.insit.ru/camera74-svobodi-slavi/index.m3u8', 'пр-кт Славы - пер. Свободы', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1201, 61.6134),
    -- ('https://hls.insit.ru/camera75-krasnix_partizan/index.m3u8', 'Площадь Красных Партизан', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1212, 61.6156),
    -- ('https://hls.insit.ru/camera76-Pobedi-Uchitelskaya/index.m3u8', 'пр. Победы - ул. Учительская', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1223, 61.6112),
    -- ('https://hls.insit.ru/camera77-Pobedi-YUnatov/index.m3u8', 'пр. Победы - пер. Юнатов', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1234, 61.6101),
    -- ('https://hls.insit.ru/camera78-pr.Ilisha/index.m3u8', 'пр-кт Ильича', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1178, 61.6167),
    -- ('https://hls.insit.ru/camera79-Slavi6/index.m3u8', 'пр-кт Славы, 6', 1, 1, 1, (SELECT id FROM cities WHERE name = 'Копейск'), 55.1189, 61.6145);

