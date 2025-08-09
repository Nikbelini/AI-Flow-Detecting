import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import cv2
from loguru import logger
from ultralytics import YOLO

from config import TIMEOUT, FRAMES_DIR, HLS_URLS, INTERVAL

model = YOLO('yolov8n.pt')


def process_frame(cam_id: int, frame: Any) -> None:
    """Обработать файл"""

    h, w = frame.shape[:2]
    logger.info(f"[cam{cam_id}] кадр {w}x{h} отправлен на обработку")
    ts = int(time.time())
    results = model(frame, classes=[0])
    annotated_frame = results[0].plot()
    # Подсчёт количества людей
    people_count = len(results[0].boxes)
    logger.info(f"Получено кол-во людей {people_count} для [cam{cam_id}] ")
    path = os.path.join(FRAMES_DIR, f"cam{cam_id}_{ts}.jpg")
    cv2.imwrite(path, annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    logger.info(f"[cam{cam_id}] сохранён {path}")


def grab_frame(cam_id: int, url: str) -> dict:
    """Прочитать один кадр из потока"""

    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, TIMEOUT * 1000)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, TIMEOUT * 1000)

    if not cap.isOpened():
        return {"cam": cam_id, "error": "Не удалось открыть поток"}

    ok, frame = cap.read()
    cap.release()

    if not ok or frame is None:
        return {"cam": cam_id, "error": "Кадр не получен"}

    return {"cam": cam_id, "frame": frame}


def startup() -> None:
    with ThreadPoolExecutor(max_workers=len(HLS_URLS)) as pool:
        logger.info("Старт цикла опроса камер")
        while True:
            start_t = time.time()
            futures = {
                pool.submit(grab_frame, cid, url): cid
                for cid, url in enumerate(HLS_URLS, 1)
            }

            for fut in as_completed(futures):
                cid = futures[fut]
                try:
                    res = fut.result()
                except Exception as e:
                    logger.exception(f"[cam{cid}] исключение: {e}")
                    continue

                if "error" in res:
                    logger.warning(f"[cam{res['cam']}] {res['error']}")
                else:
                    process_frame(res["cam"], res["frame"])

            elapsed = time.time() - start_t
            if elapsed < INTERVAL:
                time.sleep(INTERVAL - elapsed)


if __name__ == "__main__":
    try:
        startup()
    except KeyboardInterrupt:
        logger.info("Остановлено пользователем")
