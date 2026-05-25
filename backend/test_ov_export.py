from doclayout_yolo import YOLOv10
import os
from pathlib import Path

# Monkey patch openvino for doclayout-yolo compatibility
import openvino
openvino.runtime = openvino

local_pt_path = Path("data/models/doclayout_yolo_docstructbench_imgsz1024.pt")

if not local_pt_path.exists():
    print("PT file not found!")
    exit(1)

model = YOLOv10(str(local_pt_path))
ov_path = model.export(format="openvino")
print("Exported OpenVINO to:", ov_path)
