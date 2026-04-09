import os
import torch
import tempfile
import pickle
import shutil
from typing import Dict, Any, Optional
from services.locks import MODEL_LOCK

def save_model_atomic(model: torch.nn.Module, path, metadata: Optional[Dict[str, Any]] = None):
    """
    Атомарное сохранение модели + метаданных.
    path может быть str или pathlib.Path
    """
    # Приводим к строке для работы с расширениями
    path_str = str(path)
    
    with MODEL_LOCK:
        target_dir = os.path.dirname(path_str) or '.'
        os.makedirs(target_dir, exist_ok=True)
        
        # ===== Сохранение модели (.pt) =====
        with tempfile.NamedTemporaryFile(dir=target_dir, delete=False, suffix=".pt") as tmp_model:
            torch.save({
                'state_dict': model.state_dict(),
                'model_config': getattr(model, 'config', None)
            }, tmp_model.name)
            tmp_model.flush()
            os.fsync(tmp_model.fileno())
            tmp_model_path = tmp_model.name
        
        # Атомарная замена
        os.replace(tmp_model_path, path_str)
        
        # ===== Сохранение метаданных (.pkl) =====
        if metadata:
            # Используем str.replace для замены расширения
            meta_path = path_str.replace('.pt', '_meta.pkl')
            
            with tempfile.NamedTemporaryFile(dir=target_dir, delete=False, suffix=".pkl") as tmp_meta:
                pickle.dump(metadata, tmp_meta)
                tmp_meta.flush()
                os.fsync(tmp_meta.fileno())
                tmp_meta_path = tmp_meta.name
            
            _atomic_replace(tmp_meta_path, meta_path)

def _atomic_replace(src: str, dst: str):
    try:
        os.replace(src, dst)
    except OSError as exception:
        if exception.winerror == 17 or exception.errno == 18:
            shutil.copy2(src, dst)
            os.unlink(src)
        else:
            raise

def load_model_with_metadata(path) -> Optional[Dict[str, Any]]:
    """Загружает модель + метаданные"""
    try:
        with MODEL_LOCK:
            path_str = str(path)
            if not os.path.exists(path_str):
                return None
            
            checkpoint = torch.load(path_str, map_location='cpu', weights_only=True)
            
            result = {
                'state_dict': checkpoint['state_dict'],
                'model_config': checkpoint.get('model_config')
            }
            
            # Загружаем метаданные
            # Используем str.replace
            meta_path = path_str.replace('.pt', '_meta.pkl')
            if os.path.exists(meta_path):
                with open(meta_path, 'rb') as f:
                    result['metadata'] = pickle.load(f)
            
            return result
    except Exception as exception:
        print(f"Failed to load model: {exception}")
        import traceback
        traceback.print_exc()
        return None