UPDATE stops 
SET url = '' 
WHERE city_id = (SELECT id FROM cities WHERE name = 'Ульяновск');