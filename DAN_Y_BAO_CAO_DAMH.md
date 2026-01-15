# Dàn ý chi tiết báo cáo ĐAMH

## MỞ ĐẦU

## CHƯƠNG 1: GIỚI THIỆU ĐỀ TÀI VÀ NHIỆM VỤ ĐỒ ÁN

### 1.1. Giới thiệu đề tài
- 1.1.1. Bối cảnh và vấn đề
  - Nhu cầu chuyển đổi tài liệu PDF sang định dạng có thể chỉnh sửa (DOCX)
  - Khó khăn trong việc bảo toàn cấu trúc và định dạng khi chuyển đổi
  - Tầm quan trọng của việc nhận diện layout trong xử lý tài liệu
- 1.1.2. Mục tiêu của đề tài
  - Xây dựng hệ thống tự động tái tạo tài liệu DOCX từ PDF
  - Bảo toàn cấu trúc layout, định dạng văn bản và hình ảnh
  - Hỗ trợ xử lý tài liệu đa trang với độ chính xác cao

### 1.2. Phạm vi và giới hạn
- 1.2.1. Phạm vi nghiên cứu
  - Xử lý tài liệu PDF có cấu trúc rõ ràng
  - Nhận diện các thành phần: văn bản, tiêu đề, hình ảnh, bảng
  - Tái tạo định dạng cơ bản: font chữ, kích thước, màu sắc, căn lề
- 1.2.2. Giới hạn của đề tài
  - Tập trung vào tài liệu văn bản chính, không xử lý các yếu tố phức tạp như công thức toán học
  - Chưa xử lý tài liệu quét (scan) hoặc PDF dạng hình ảnh
  - Độ chính xác phụ thuộc vào chất lượng mô hình YOLO

### 1.3. Nhiệm vụ đồ án
- 1.3.1. Nhiệm vụ chính
  - Nghiên cứu và áp dụng mô hình DocLayout-YOLO cho nhận diện layout
  - Xây dựng pipeline xử lý PDF đa trang
  - Phát triển thuật toán matching giữa text elements và layout regions
  - Triển khai hệ thống tái tạo DOCX với định dạng tương ứng
- 1.3.2. Sản phẩm đồ án
  - Hệ thống Python xử lý PDF và tạo DOCX
  - Notebook Jupyter demo quy trình xử lý
  - Tài liệu báo cáo mô tả phương pháp và kết quả

### 1.4. Cấu trúc báo cáo

## CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ CÔNG NGHỆ SỬ DỤNG

### 2.1. Tổng quan về xử lý tài liệu PDF
- 2.1.1. Định dạng PDF và đặc điểm
  - Cấu trúc file PDF
  - Các thành phần trong PDF: text, images, metadata
  - Khó khăn trong việc trích xuất thông tin từ PDF
- 2.1.2. Thư viện PyMuPDF (fitz)
  - Giới thiệu PyMuPDF
  - Các chức năng chính: đọc PDF, trích xuất text, metadata
  - Trích xuất thông tin định dạng: font, size, color, flags

### 2.2. Nhận diện layout tài liệu bằng Deep Learning
- 2.2.1. Bài toán Document Layout Analysis
  - Khái niệm và ứng dụng
  - Các phương pháp truyền thống vs Deep Learning
  - Các loại layout regions: text block, title, figure, table, list
- 2.2.2. Mô hình YOLO và biến thể
  - Kiến trúc YOLO cơ bản
  - YOLOv10 và cải tiến
  - Ưu điểm của YOLO cho object detection trong tài liệu
- 2.2.3. DocLayout-YOLO
  - Giới thiệu mô hình DocLayout-YOLO
  - Dataset training và các lớp nhận diện
  - Hiệu suất và độ chính xác

### 2.3. Thuật toán IoU Matching
- 2.3.1. Khái niệm Intersection over Union (IoU)
  - Công thức tính IoU
  - Ứng dụng trong matching bounding boxes
- 2.3.2. Matching text elements với layout regions
  - Chiến lược matching dựa trên IoU
  - Xử lý trường hợp overlap và conflict
  - Tối ưu hóa độ chính xác matching

### 2.4. Xử lý tài liệu DOCX
- 2.4.1. Định dạng DOCX
  - Cấu trúc file DOCX (XML-based)
  - Các thành phần: paragraphs, runs, styles
- 2.4.2. Thư viện python-docx
  - Giới thiệu python-docx
  - Tạo và chỉnh sửa tài liệu DOCX
  - Thiết lập định dạng: font, size, color, alignment

### 2.5. Chuyển đổi hệ tọa độ
- 2.5.1. Hệ tọa độ PDF space
  - Hệ tọa độ trong PyMuPDF
  - Đơn vị và gốc tọa độ
- 2.5.2. Hệ tọa độ Image space
  - Tọa độ pixel trong ảnh render
  - Tỷ lệ scale giữa PDF và image
- 2.5.3. Chuyển đổi giữa các hệ tọa độ
  - Công thức chuyển đổi PDF to Image
  - Công thức chuyển đổi Image to PDF
  - Ứng dụng trong matching coordinates

## CHƯƠNG 3: PHÂN TÍCH – THIẾT KẾ

### 3.1. Phân tích yêu cầu
- 3.1.1. Yêu cầu chức năng
  - Đọc và xử lý file PDF đa trang
  - Nhận diện layout regions trên mỗi trang
  - Trích xuất text elements với metadata
  - Matching text với layout regions
  - Tạo file DOCX với định dạng tương ứng
- 3.1.2. Yêu cầu phi chức năng
  - Hiệu suất xử lý hợp lý cho tài liệu nhiều trang
  - Độ chính xác trong việc bảo toàn layout
  - Dễ mở rộng và bảo trì code

### 3.2. Kiến trúc hệ thống
- 3.2.1. Tổng quan kiến trúc
  - Mô tả luồng xử lý tổng thể
  - Các module chính và vai trò
- 3.2.2. Pipeline xử lý
  - Bước 1: Load PDF và render pages
  - Bước 2: Detect layout regions bằng YOLO
  - Bước 3: Extract text elements từ PDF
  - Bước 4: Match text với layout regions
  - Bước 5: Tạo DOCX với định dạng

### 3.3. Thiết kế các module
- 3.3.1. Module PDF Processing
  - Chức năng: đọc PDF, render pages, extract text
  - Input/Output
  - Các hàm chính
- 3.3.2. Module Layout Detection
  - Chức năng: load YOLO model, detect regions
  - Input/Output
  - Xử lý kết quả detection
- 3.3.3. Module IoU Matching
  - Chức năng: match text elements với layout regions
  - Thuật toán matching
  - Xử lý edge cases
- 3.3.4. Module DOCX Generation
  - Chức năng: tạo DOCX từ matched data
  - Ánh xạ layout classes sang DOCX elements
  - Thiết lập định dạng

### 3.4. Cấu trúc dữ liệu
- 3.4.1. TextElement
  - Các thuộc tính: text, bbox, font, size, color
  - Mục đích sử dụng
- 3.4.2. LayoutRegion
  - Các thuộc tính: bbox, class_name, score
  - Mục đích sử dụng
- 3.4.3. MatchedBlock
  - Cấu trúc dữ liệu sau khi matching
  - Thông tin layout và text elements

### 3.5. Thuật toán chính
- 3.5.1. Thuật toán IoU Matching
  - Mô tả chi tiết thuật toán
  - Pseudocode
  - Độ phức tạp
- 3.5.2. Thuật toán tạo DOCX
  - Quy trình tạo paragraphs, runs
  - Áp dụng định dạng
  - Xử lý hình ảnh

## CHƯƠNG 4: TRIỂN KHAI THỰC NGHIỆM VÀ KẾT QUẢ

### 4.1. Môi trường phát triển
- 4.1.1. Công cụ và thư viện
  - Python version
  - Các thư viện chính: PyMuPDF, doclayout-yolo, python-docx
  - Jupyter Notebook cho development
- 4.1.2. Cấu hình hệ thống
  - Yêu cầu phần cứng
  - Cấu hình mô hình YOLO

### 4.2. Triển khai hệ thống
- 4.2.1. Cài đặt và cấu hình
  - Cài đặt dependencies
  - Download và load mô hình YOLO
  - Cấu hình đường dẫn và tham số
- 4.2.2. Implementation các module
  - Module pdf_utils: render và coordinate conversion
  - Module iou_matching: matching algorithms
  - Main pipeline: tích hợp các module
- 4.2.3. Xử lý đa trang
  - Quy trình xử lý từng trang
  - Tổng hợp kết quả
  - Tối ưu hóa bộ nhớ

### 4.3. Thực nghiệm và đánh giá
- 4.3.1. Dataset thử nghiệm
  - Mô tả tài liệu PDF test
  - Đặc điểm của test cases
- 4.3.2. Kết quả thực nghiệm
  - Kết quả nhận diện layout
  - Độ chính xác matching
  - Chất lượng DOCX output
  - So sánh với PDF gốc
- 4.3.3. Phân tích kết quả
  - Điểm mạnh của hệ thống
  - Các trường hợp xử lý tốt
  - Hạn chế và lỗi phát hiện
  - Nguyên nhân và hướng khắc phục

### 4.4. Kết luận
- 4.4.1. Tổng kết
  - Đạt được các mục tiêu đề ra
  - Đóng góp của đồ án
- 4.4.2. Hạn chế
  - Các giới hạn hiện tại
  - Khó khăn gặp phải
- 4.4.3. Hướng phát triển
  - Cải thiện độ chính xác matching
  - Hỗ trợ thêm các loại layout phức tạp
  - Xử lý tài liệu quét và OCR
  - Tối ưu hóa hiệu suất
  - Phát triển giao diện người dùng

## TÀI LIỆU THAM KHẢO

## PHỤ LỤC (nếu có)
- Phụ lục A: Mã nguồn chính
- Phụ lục B: Kết quả thực nghiệm chi tiết
- Phụ lục C: Hướng dẫn sử dụng
