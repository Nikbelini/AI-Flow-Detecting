import os
import torch
import tempfile
import pickle
import shutil
from typing import Dict, Any, Optional
from services.locks import MODEL_LOCK

def save_model_atomic(model: torch.nn.Module, path: str, metadata: Optional[Dict[str, Any]] = None):
    """
    Атомарное сохранение модели + метаданных.
    Исправлено: работает на Windows при разных дисках для temp и target.
    """
    with MODEL_LOCK:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        
        # ===== Сохранение модели (.pt) =====
        # Создаём temp-файл В ТОЙ ЖЕ ПАПКЕ, что и целевой (для атомарности + кросс-дисков)
        target_dir = os.path.dirname(path) or '.'
        
        with tempfile.NamedTemporaryFile(dir=target_dir, delete=False, suffix=".pt") as tmp_model:
            torch.save({
                'state_dict': model.state_dict(),
                'model_config': getattr(model, 'config', None)
            }, tmp_model.name)
            tmp_model.flush()
            os.fsync(tmp_model.fileno())
            tmp_model_path = tmp_model.name
        
        # Атомарная замена (теперь в пределах одного диска)
        os.replace(tmp_model_path, path)
        
        # ===== Сохранение метаданных (.pkl) =====
        if metadata:
            meta_path = path.replace('.pt', '_meta.pkl')
            
            with tempfile.NamedTemporaryFile(dir=target_dir, delete=False, suffix=".pkl") as tmp_meta:
                pickle.dump(metadata, tmp_meta)
                tmp_meta.flush()
                os.fsync(tmp_meta.fileno())
                tmp_meta_path = tmp_meta.name
            
            # Кросс-платформенная замена
            _atomic_replace(tmp_meta_path, meta_path)

def _atomic_replace(src: str, dst: str):
    """
    Атомарная замена файла с фоллбэком для Windows.
    """
    try:
        os.replace(src, dst)
    except OSError as e:
        # WinError 17: cross-device link — фоллбэк на copy+delete
        if e.winerror == 17 or e.errno == 18:  # EXDEV on Unix
            shutil.copy2(src, dst)
            os.unlink(src)
        else:
            raise

def load_model_with_metadata(path: str) -> Optional[Dict[str, Any]]:
    """Загружает модель + метаданные"""
    try:
        with MODEL_LOCK:
            if not os.path.exists(path):
                return None
            
            checkpoint = torch.load(path, map_location='cpu', weights_only=True)
            
            result = {
                'state_dict': checkpoint['state_dict'],
                'model_config': checkpoint.get('model_config')
            }
            
            # Загружаем метаданные
            meta_path = path.replace('.pt', '_meta.pkl')
            if os.path.exists(meta_path):
                with open(meta_path, 'rb') as f:
                    result['metadata'] = pickle.load(f)
            
            return result
    except Exception as e:
        print(f"Failed to load model: {e}")
        return None