"""
Model loading and configuration utilities.
"""

from pathlib import Path
from typing import Optional

from doclayout_yolo import YOLOv10
from huggingface_hub import hf_hub_download


class ModelConfig:
    """Configuration for DocLayout-YOLO model."""

    REPO_ID = "juliozhao/DocLayout-YOLO-DocStructBench"
    FILENAME = "doclayout_yolo_docstructbench_imgsz1024.pt"
    INPUT_SIZE = 640
    CONFIDENCE_THRESHOLD = 0.2
    DEVICE = "cpu"  # Can be changed to "cuda" if GPU is available
import os
import shutil
from pathlib import Path

# Monkey patch openvino for doclayout-yolo compatibility
try:
    import openvino
    openvino.runtime = openvino
except ImportError:
    pass

def load_doclayout_model(
    repo_id: Optional[str] = None,
    filename: Optional[str] = None,
    device: Optional[str] = None,
) -> YOLOv10:
    """
    Load DocLayout-YOLO model from Hugging Face Hub and use OpenVINO version.
    """
    repo_id = repo_id or ModelConfig.REPO_ID
    filename = filename or ModelConfig.FILENAME
    device = device or ModelConfig.DEVICE

    print(f"Fetching DocLayout-YOLO model from {repo_id}/{filename}...")
    model_path = hf_hub_download(repo_id=repo_id, filename=filename)
    
    # Store models in local data dir to avoid modifying HF cache
    models_dir = Path("data/models")
    models_dir.mkdir(parents=True, exist_ok=True)
    
    ov_dirname = filename.replace(".pt", "_openvino_model")
    ov_path = models_dir / ov_dirname
    
    if not ov_path.exists():
        print(f"Exporting model to {ov_path} for faster CPU inference...")
        local_pt_path = models_dir / filename
        if not local_pt_path.exists():
            shutil.copy2(model_path, local_pt_path)
            
        model = YOLOv10(str(local_pt_path))
        model.export(format="openvino", imgsz=ModelConfig.INPUT_SIZE)
        
    print(f"Loading OpenVINO model from {ov_path}")
    model = YOLOv10(str(ov_path))
    print("OpenVINO Model loaded successfully!")

    return model
