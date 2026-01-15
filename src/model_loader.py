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
    INPUT_SIZE = 1024
    CONFIDENCE_THRESHOLD = 0.2
    DEVICE = "cpu"  # Can be changed to "cuda" if GPU is available


def load_doclayout_model(
    repo_id: Optional[str] = None,
    filename: Optional[str] = None,
    device: Optional[str] = None,
) -> YOLOv10:
    """
    Load DocLayout-YOLO model from Hugging Face Hub.
    
    Args:
        repo_id: Hugging Face repository ID (defaults to ModelConfig.REPO_ID)
        filename: Model filename (defaults to ModelConfig.FILENAME)
        device: Device to run model on (defaults to ModelConfig.DEVICE)
        
    Returns:
        YOLOv10: Loaded model instance
    """
    repo_id = repo_id or ModelConfig.REPO_ID
    filename = filename or ModelConfig.FILENAME
    device = device or ModelConfig.DEVICE
    
    print(f"Loading DocLayout-YOLO model from {repo_id}/{filename}...")
    model_path = hf_hub_download(repo_id=repo_id, filename=filename)
    model = YOLOv10(model_path)
    print("Model loaded successfully!")
    
    return model
