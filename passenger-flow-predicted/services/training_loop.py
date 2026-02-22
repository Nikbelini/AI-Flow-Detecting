import time
from database.db import load_stop_history
from train_stgcn import train
from services.data_guard import has_enough_data

RETRAIN_INTERVAL = 60 * 60  # 1 час

def training_loop(city_id: int):
    trained_once = False

    while True:
        df = load_stop_history(city_id)

        if has_enough_data(df):
            print("🧠 Training model...")
            train(city_id)
            trained_once = True
        else:
            print("⏳ Waiting for data...")

        time.sleep(60 * 60 if trained_once else 60 * 5)

