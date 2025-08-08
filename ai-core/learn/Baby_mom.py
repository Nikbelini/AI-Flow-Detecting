import cv2
from ultralytics import YOLO
import time
import os
from datetime import datetime
import torch

# Проверяем доступность CUDA
device = 'cuda' if torch.cuda.is_available() else 'cpu'
print(f"Используется устройство: {device}")
# Настройки
STREAM_URLS = [
    "https://restreamer.vms.evo73.ru/1376e7dd864af96d/stream.m3u8",
    "https://restreamer.vms.evo73.ru/1146b0835f27c55a/stream.m3u8",
    "https://restreamer.vms.evo73.ru/5503e3c73f58d42e/stream.m3u8",    # Замените на реальные URL
    "https://restreamer.vms.evo73.ru/601c2394d4f0298e/stream.m3u8",   # Замените на реальные URL
    "https://restreamer.vms.evo73.ru/9a9925e405a8cce4/stream.m3u8"     # Замените на реальные URL
]



OUTPUT_FOLDERS = ["data_files/screen_1", "data_files/screen_2", "data_files/screen_3", "data_files/screen_4", "data_files/screen_5"]

INTERVAL_SEC = 10   # Интервал между скриншотами (секунды)

model = YOLO('yolov8n.pt') 
# Создаем папки для сохранения скриншотов

os.makedirs("data_files", exist_ok=True)
history = open("data_files/history.txt","w")

for folder in OUTPUT_FOLDERS:
    os.makedirs(folder, exist_ok=True)

# Подключаемся к видео потокам
cams = [cv2.VideoCapture(url) for url in STREAM_URLS]
sets=[]
def YOLO_BABY(string,i):
    
    image = cv2.imread(string)
    # Детекция людей (класс '0' в COCO = человек)
    results = model(image, classes=[0])  

    annotated_image = results[0].plot() 
    # Подсчёт количества людей
    people_count = len(results[0].boxes)
    
    cv2.imwrite(filename, annotated_image)
    history.write(f'На фото {i} распознано: {people_count} людей\n')
    sets.append(people_count)
    

# Проверяем подключение ко всем камерам
for i, cam in enumerate(cams, 1):
    if not cam.isOpened():
        print(f"Ошибка: Не удалось подключиться к видео потоку {i}")
        exit()

print(f"Начало записи скриншотов каждые {INTERVAL_SEC} секунд...")
last_capture_time = time.time()

while True:
    # Читаем кадры со всех камер
    frames = []
    rets = []
    for cam in cams:
        ret, frame = cam.read()
        rets.append(ret)
        frames.append(frame)
    
    # Проверяем успешность чтения всех кадров
    if not all(rets):
        print("Ошибка: Не удалось получить кадры со всех камер")
        break
    
    current_time = time.time()
    
    # Проверяем, прошло ли достаточно времени для нового скриншота
    if current_time - last_capture_time >= INTERVAL_SEC:
        # Генерируем имя файла с текущей датой и временем
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Сохраняем скриншоты со всех камер
        history.write("_"*20+'\n')
        for i, (frame, folder) in enumerate(zip(frames, OUTPUT_FOLDERS), 1):
            filename = f"{folder}/{timestamp}.jpg"
            cv2.imwrite(filename, frame)
            print(f"Скриншот камеры {i} сохранен: {filename}")
            
            YOLO_BABY(filename, i)

        last_capture_time = current_time
    
        for j in range(len(sets)):
            print(sets[j])
        sets.clear()
    # Для выхода нажмите 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Освобождаем ресурсы
for cam in cams:
    cam.release()
history.close()
cv2.destroyAllWindows()
