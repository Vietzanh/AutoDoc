from doclayout_yolo import YOLOv10
from huggingface_hub import hf_hub_download
import os

repo_id = "juliozhao/DocLayout-YOLO-DocStructBench"
filename = "doclayout_yolo_docstructbench_imgsz1024.pt"

model_path = hf_hub_download(repo_id=repo_id, filename=filename)
print("Downloaded to:", model_path)

model = YOLOv10(model_path)
print("Loaded PT model.")

# try export
onnx_path = model.export(format="onnx")
print("Exported ONNX to:", onnx_path)
