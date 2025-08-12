import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import cv2
# import torch
from httpx import HTTPError
from loguru import logger
from ultralytics import YOLO

from clients.flow_detect_client import FlowDetectClient
from clients.schemas import StopsUrlSchema
from config import (
    TIMEOUT,
    FRAMES_DIR,
    HLS_URLS,
    INTERVAL,
    FLOW_DETECTION_URL,
    PEOPLE_DETECTION_IS_ENABLED,
    FLOW_DETECTION_INTEGRATION_IS_ENABLED,
    FRAME_SAVE_IS_ENABLED,
)

model = YOLO("best.pt")
# device = torch.device("cpu")
flow_detection_client = FlowDetectClient(url=FLOW_DETECTION_URL)


def process_frame(stop_id: int, frame: Any) -> None:
    """Обработать файл"""

    h, w = frame.shape[:2]
    logger.info(f"[stop{stop_id}] кадр {w}x{h} отправлен на обработку")
    ts = int(time.time())
    if PEOPLE_DETECTION_IS_ENABLED:
        results = model(frame, classes=[0])
        frame = results[0].plot()
        people_count = len(results[0].boxes)
    else:
        people_count = 322

    logger.info(f"Получено кол-во людей {people_count} для [stop{stop_id}] ")
    if FLOW_DETECTION_INTEGRATION_IS_ENABLED:
        try:
            flow_detection_client.patch_stops_metrics(stop_id, people_count)
        except HTTPError as exc:
            logger.exception(f"{exc}")
    if FRAME_SAVE_IS_ENABLED:
        path = os.path.join(FRAMES_DIR, f"stop{stop_id}_{ts}.jpg")
        cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        logger.info(f"[stop{stop_id}] сохранён {path}")


def grab_frame(stop_id: int, url: str) -> dict:
    """Прочитать один кадр из потока"""

    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, TIMEOUT * 1000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, TIMEOUT * 1000)

    if not cap.isOpened():
        return {"stop": stop_id, "error": "Не удалось открыть поток"}

    ok, frame = cap.read()
    cap.release()

    if not ok or frame is None:
        return {"stop": stop_id, "error": "Кадр не получен"}

    return {"stop": stop_id, "frame": frame}


def startup() -> None:
    if FLOW_DETECTION_INTEGRATION_IS_ENABLED:
        urls = flow_detection_client.get_stops_urls()
    else:
        urls = [StopsUrlSchema(id=1, url=HLS_URLS[0])]
    with ThreadPoolExecutor(max_workers=len(urls)) as pool:
        logger.info("Старт цикла опроса камер")
        while True:
            start_t = time.time()
            futures = {
                pool.submit(grab_frame, url.id, url.url): url.id
                for url in urls
            }

            for fut in as_completed(futures):
                cid = futures[fut]
                try:
                    res = fut.result()
                except Exception as e:
                    logger.exception(f"[cam{cid}] исключение: {e}")
                    continue

                if "error" in res:
                    logger.warning(f"[stop{res['stop']}] {res['error']}")
                else:
                    process_frame(res["stop"], res["frame"])

            elapsed = time.time() - start_t
            if elapsed < INTERVAL:
                time.sleep(INTERVAL - elapsed)


if __name__ == "__main__":
    try:
        startup()
    except KeyboardInterrupt:
        logger.info("Остановлено пользователем")
