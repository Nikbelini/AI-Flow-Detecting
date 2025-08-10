import os

HLS_URLS = [
    "https://restreamer.vms.evo73.ru/918335436b92ac26/stream.m3u8",
    # "https://restreamer.vms.evo73.ru/1376e7dd864af96d/stream.m3u8",
    # "https://restreamer.vms.evo73.ru/1146b0835f27c55a/stream.m3u8",
    # "https://restreamer.vms.evo73.ru/5503e3c73f58d42e/stream.m3u8",
    # "https://restreamer.vms.evo73.ru/601c2394d4f0298e/stream.m3u8",
    # "https://restreamer.vms.evo73.ru/9a9925e405a8cce4/stream.m3u8"
]
INTERVAL = 30
TIMEOUT = 8
FRAMES_DIR = os.path.join(os.path.dirname(__file__), "frames")
# os.makedirs(FRAMES_DIR, exist_ok=True)

FLOW_DETECTION_URL = "http://flowdetect-app:8080"
FLOW_DETECTION_INTEGRATION_IS_ENABLED = True
PEOPLE_DETECTION_IS_ENABLED = True
FRAME_SAVE_IS_ENABLED = True
