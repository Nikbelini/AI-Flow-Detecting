import os
import torch
import tempfile
from services.locks import MODEL_LOCK

def save_model_atomic(model, path):
    with MODEL_LOCK:
        os.makedirs(os.path.dirname(path), exist_ok=True)

    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        torch.save(model.state_dict(), tmp.name)
        tmp.flush()
        os.fsync(tmp.fileno())

    os.replace(tmp.name, path)  # atomic
