# transport-modeling-service/import_osm_data.py
"""
Скрипт для импорта OSM XML данных в PostgreSQL
Сохраняет порядок остановок в маршрутах!
"""

import xml.etree.ElementTree as ET
import asyncpg
import random
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
from collections import defaultdict

logger = logging.getLogger(__name__)

# ========== КОНФИГУРАЦИЯ ==========
CITY_NAME = "Ульяновск"
CITY_LAT = 54.3181
CITY_LNG = 48.3868

HISTORY_DAYS = 14
HISTORY_START_HOUR = 3
HISTORY_END_HOUR = 26

FORCE_RELOAD = True


def parse_transport_type(ref: str) -> str:
    """Определение типа транспорта по номеру маршрута"""
    ref = str(ref).lower()
    if ref.startswith('тр'):
        return 'TROLLEYBUS'
    elif ref.startswith('тм'):
        return 'TRAM'
    else:
        return 'BUS'


async def clear_tables_except_city(conn, city_id: int):
    """Очищает все таблицы"""
    logger.info("\n🧹 Очистка старых данных...")
    
    await conn.execute("DELETE FROM stops_history WHERE city_id = $1", city_id)
    logger.info("   ✅ Очищена stops_history")
    
    await conn.execute("""
        DELETE FROM route_stops 
        WHERE route_id IN (SELECT id FROM routes WHERE city_id = $1)
    """, city_id)
    logger.info("   ✅ Очищена route_stops")
    
    await conn.execute("DELETE FROM routes WHERE city_id = $1", city_id)
    logger.info("   ✅ Очищена routes")
    
    await conn.execute("DELETE FROM stops WHERE city_id = $1", city_id)
    logger.info("   ✅ Очищена stops")
    
    try:
        import redis
        r = redis.Redis(host="redis", port=6379, decode_responses=True)
        r.flushdb()
        logger.info("   ✅ Очищен Redis кэш")
    except Exception as e:
        logger.warning(f"   ⚠️ Не удалось очистить Redis: {e}")
    
    logger.info("   ✅ Все данные очищены")


def parse_osm_xml(xml_path: str) -> Tuple[Dict, Dict]:
    """
    Парсинг OSM XML файла
    Возвращает: (nodes, relations)
    nodes: dict node_id -> {lat, lon, name}
    relations: dict relation_id -> {ref, name, type, members (в правильном порядке)}
    """
    
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    nodes = {}
    relations = {}
    
    # 1. Парсим все узлы (остановки)
    for node in root.findall('node'):
        node_id = node.get('id')
        lat = float(node.get('lat'))
        lon = float(node.get('lon'))
        
        # Парсим теги
        tags = {}
        for tag in node.findall('tag'):
            tags[tag.get('k')] = tag.get('v')
        
        # Проверяем, что это остановка
        is_stop = False
        if tags.get('highway') == 'bus_stop':
            is_stop = True
        elif tags.get('public_transport') == 'platform':
            is_stop = True
        elif tags.get('railway') == 'tram_stop':
            is_stop = True
        
        if is_stop:
            name = tags.get('name', f"Остановка {node_id}")
            nodes[node_id] = {
                'id': node_id,
                'lat': lat,
                'lon': lon,
                'name': name
            }
    
    # 2. Парсим все отношения (маршруты)
    for relation in root.findall('relation'):
        # Парсим теги
        tags = {}
        for tag in relation.findall('tag'):
            tags[tag.get('k')] = tag.get('v')
        
        # Проверяем, что это маршрут
        route_type = tags.get('route')
        if route_type not in ['bus', 'trolleybus', 'tram']:
            continue
        
        # Парсим члены relation (ВАЖНО: порядок сохраняется!)
        members = []
        for member in relation.findall('member'):
            member_type = member.get('type')
            member_ref = member.get('ref')
            member_role = member.get('role')
            
            # Нас интересуют только остановки
            if member_type == 'node' and ('stop' in member_role or 'platform' in member_role):
                if member_ref in nodes:
                    members.append({
                        'ref': member_ref,
                        'role': member_role
                    })
        
        if members:
            relation_id = relation.get('id')
            relations[relation_id] = {
                'id': relation_id,
                'ref': tags.get('ref', ''),
                'name': tags.get('name', ''),
                'type': route_type,
                'members': members  # ← ПОРЯДОК СОХРАНЁН!
            }
    
    logger.info(f"   ✅ Найдено {len(nodes)} остановок")
    logger.info(f"   ✅ Найдено {len(relations)} маршрутов")
    
    return nodes, relations


async def import_osm_data(pool: asyncpg.Pool, xml_path: str = "uly-small.xml", force_reload: bool = False):
    """Импорт данных из OSM XML файла"""
    
    logger.info("=" * 60)
    logger.info("🚀 ЗАПУСК ИМПОРТА OSM XML ДАННЫХ")
    logger.info("=" * 60)
    
    logger.info(f"📂 Чтение файла: {xml_path}")
    try:
        nodes, relations = parse_osm_xml(xml_path)
    except FileNotFoundError:
        logger.warning(f"⚠️ Файл {xml_path} не найден")
        return
    except Exception as e:
        logger.error(f"❌ Ошибка парсинга XML: {e}")
        return
    
    if not nodes and not relations:
        logger.warning("⚠️ Нет данных для импорта")
        return
    
    async with pool.acquire() as conn:
        # 1. Проверяем/добавляем город
        logger.info("\n🏙️ Проверка города...")
        
        city_row = await conn.fetchrow(
            "SELECT id FROM cities WHERE name = $1",
            CITY_NAME
        )
        
        if city_row:
            city_id = city_row["id"]
            logger.info(f"   ✅ Город уже существует (ID: {city_id})")
            
            if force_reload:
                logger.info("   🔄 Принудительная перезагрузка данных...")
                await clear_tables_except_city(conn, city_id)
        else:
            city_id = await conn.fetchval("""
                INSERT INTO cities (name, lat, lng)
                VALUES ($1, $2, $3)
                RETURNING id
            """, CITY_NAME, CITY_LAT, CITY_LNG)
            logger.info(f"   ✅ Город добавлен (ID: {city_id})")
        
        # 2. Вставляем остановки
        logger.info("\n💾 Вставка остановок...")
        stop_id_map = {}
        
        for node_id, node in nodes.items():
            try:
                stop_id = await conn.fetchval("""
                    INSERT INTO stops (address, lat, lng, count, velocity, load, city_id, url)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    RETURNING id
                """, node['name'], node['lat'], node['lon'],
                    1, 1, 1, city_id, "")
                stop_id_map[node_id] = stop_id
            except Exception as e:
                logger.warning(f"   ⚠️ Ошибка вставки {node['name']}: {e}")
        
        logger.info(f"   ✅ Вставлено {len(stop_id_map)} остановок")
        
        # 3. Вставляем маршруты с ПРАВИЛЬНЫМ ПОРЯДКОМ
        logger.info("\n🛤️ Вставка маршрутов...")
        routes_inserted = 0
        
        for rel_id, route in relations.items():
            route_ref = route['ref']
            route_name = route['name']
            route_type = route['type'].upper()
            
            if not route_ref:
                continue
            
            try:
                route_id = await conn.fetchval("""
                    INSERT INTO routes (number, name, transport_type, is_active, city_id, interval_minutes)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                """, route_ref, route_name[:128] if route_name else "",
                    route_type, True, city_id, 15)
                
                if not route_id:
                    continue
                
                # Вставляем остановки в ТОМ ЖЕ ПОРЯДКЕ, что и в XML
                for idx, member in enumerate(route['members']):
                    node_id = member['ref']
                    if node_id not in stop_id_map:
                        continue
                    
                    stop_db_id = stop_id_map[node_id]
                    role = member['role']
                    direction = "A" if "forward" in role else "B"
                    
                    await conn.execute("""
                        INSERT INTO route_stops (route_id, stop_id, order_in_route, direction, is_active)
                        VALUES ($1, $2, $3, $4, $5)
                    """, route_id, stop_db_id, idx, direction, True)
                
                routes_inserted += 1
                if routes_inserted % 10 == 0:
                    logger.info(f"      Вставлено {routes_inserted} маршрутов...")
                
            except Exception as e:
                logger.warning(f"   ⚠️ Ошибка вставки маршрута {route_ref}: {e}")
        
        logger.info(f"   ✅ Вставлено {routes_inserted} маршрутов")
        
        # 4. Генерация исторических данных
        logger.info("\n📊 Генерация исторических данных...")
        
        from history_generator import generate_stop_history
        
        history_count = 0
        
        for node_id, node in nodes.items():
            if node_id not in stop_id_map:
                continue
            
            stop_db_id = stop_id_map[node_id]

            is_camera_stop = (int(node_id) % 3 == 0)

            if not is_camera_stop:
                # ПРОПУСКАЕМ генерацию истории для слепых остановок
                # Они просто не попадут в stops_history → в тензоре будут нули (отсутствие данных)
                continue
            
            stop_db_id = stop_id_map[node_id]
            records = generate_stop_history(
                node_id=node_id,
                stop_db_id=stop_db_id,
                address=node["name"],
                node_lat=node["lat"],
                node_lon=node["lon"],
                city_id=city_id,
                city_name=CITY_NAME,
                history_days=HISTORY_DAYS,
                start_hour=HISTORY_START_HOUR,
                end_hour=HISTORY_END_HOUR,
            )

            for rec in records:
                try:
                    await conn.execute("""
                        INSERT INTO stops_history
                            (city_id, stop_id, address, lat, lng, count, velocity, load, datetime)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """,
                        rec["city_id"], rec["stop_id"], rec["address"],
                        rec["lat"], rec["lng"], rec["count"],
                        rec["velocity"], rec["load"], rec["datetime"],
                    )
                    history_count += 1
                except Exception:
                    pass

            if history_count % 10000 == 0 and history_count > 0:
                logger.info(f"      Сгенерировано {history_count} записей...")
        
        logger.info(f"   ✅ Сгенерировано {history_count} записей истории")
        
        # 5. Итоговая статистика
        stops_total = await conn.fetchval("SELECT COUNT(*) FROM stops WHERE city_id = $1", city_id)
        routes_total = await conn.fetchval("SELECT COUNT(*) FROM routes WHERE city_id = $1", city_id)
        history_total = await conn.fetchval("SELECT COUNT(*) FROM stops_history WHERE city_id = $1", city_id)
        
        logger.info("\n" + "=" * 60)
        logger.info("📊 ИТОГОВАЯ СТАТИСТИКА")
        logger.info("=" * 60)
        logger.info(f"   🏙️ Город: {CITY_NAME} (ID: {city_id})")
        logger.info(f"   🚏 Остановок: {stops_total}")
        logger.info(f"   🛤️ Маршрутов: {routes_total}")
        logger.info(f"   📊 Исторических записей: {history_total}")
        logger.info("\n✅ ПОРЯДОК ОСТАНОВОК СОХРАНЁН!")
        logger.info("=" * 60)
        logger.info("✅ ИМПОРТ ЗАВЕРШЁН УСПЕШНО!")


async def run_import_if_needed_ul(pool: asyncpg.Pool):
    """
    Проверяет, нужно ли выполнять импорт, и запускает его
    """
    async with pool.acquire() as conn:
        city = await conn.fetchrow("SELECT id FROM cities WHERE name = $1", CITY_NAME)
        
        if city:
            city_id = city["id"]
            stops_count = await conn.fetchval("SELECT COUNT(*) FROM stops WHERE city_id = $1", city_id)
            
            if stops_count > 0 and not FORCE_RELOAD:
                logger.info(f"✅ Данные уже есть ({stops_count} остановок), пропускаем импорт")
                return
        
        logger.info("📭 Запускаем импорт из XML...")
        await import_osm_data(pool, force_reload=FORCE_RELOAD)