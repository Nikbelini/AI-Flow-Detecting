# transport-modeling-service/run.py
#!/usr/bin/env python
"""
Точка входа для запуска сервиса моделирования
"""
import sys
import os
import uvicorn

# Добавляем текущую директорию в путь Python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 50)
print("🚀 ЗАПУСК TRANSPORT-MODELING-SERVICE")
print("=" * 50)
print(f"📂 Текущая директория: {os.getcwd()}")
print(f"📁 Файлы в директории: {os.listdir('.')}")
print(f"🐍 Python path: {sys.path}")
print("=" * 50)

# Импортируем приложение для проверки
try:
    from main import app
    print("✅ main.app импортирован успешно!")
except Exception as e:
    print(f"❌ Ошибка импорта main: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

if __name__ == "__main__":
    print("🌐 Запуск сервера на http://0.0.0.0:8084")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8084,
        reload=True,
        reload_dirs=["/app"],
        log_level="info"
    )