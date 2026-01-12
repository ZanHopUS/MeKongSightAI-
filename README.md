
MEKONGSIGHT AI - HỆ THỐNG GIÁM SÁT MÔI TRƯỜNG ĐA PHƯƠNG THỨC (IoT + AI)

1. GIỚI THIỆU

MekongSight AI là giải pháp công nghệ hỗ trợ nông dân ĐBSCL giám sát mô hình Lúa - Tôm.
Hệ thống kết hợp:
- IoT Digital Twin: Giả lập và cảnh báo môi trường (Độ mặn, pH, Nhiệt độ).
- AI Vision: Chẩn đoán bệnh lúa qua hình ảnh camera.
- Data Service: Tích hợp dữ liệu thời tiết thực và thủy triều từ vệ tinh.

2. CẤU TRÚC DỰ ÁN (MVC LITE)

MekongSightAI/
 ├── app/                   # Mã nguồn chính (Backend & Frontend)
 │    ├── main.py           # Server xử lý trung tâm (FastAPI)
 │    ├── static/           # Chứa file CSS, JS, Hình ảnh
 │    └── templates/        # Chứa giao diện HTML (Admin & User)
 ├── admin.html             # Web điều chỉnh dữ liệu
 ├── check_ai.py            # Kiểm tra API_KEY có thể sử dụng
 ├── iot_simulator.py       # Tool giả lập dữ liệu tự động (Optional)
 ├── sensor_data.json       # Cơ sở dữ liệu mini (Tự động tạo)
 ├── cloudflared.exe        # Công cụ đưa Web lên Internet
 ├── requirements.txt       # Danh sách thư viện cần cài đặt
 └── README.txt             # Hướng dẫn sử dụng

3. CÀI ĐẶT MÔI TRƯỜNG

Yêu cầu: Đã cài đặt Python 3.9 trở lên.

Bước 1: Mở Terminal (CMD/PowerShell) tại thư mục dự án.
Bước 2: Cài đặt các thư viện phụ thuộc bằng lệnh:
   pip install -r requirements.txt

4. HƯỚNG DẪN CHẠY DEMO

>>> BƯỚC 1: KHỞI ĐỘNG SERVER
Mở Terminal, chạy lệnh sau:
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

>>> BƯỚC 2: TẠO ĐƯỜNG DẪN ONLINE (Để truy cập bằng điện thoại)
Mở một Terminal khác, chạy lệnh:
   .\cloudflared tunnel --url http://localhost:8000

Copy đường link có đuôi ".trycloudflare.com" hiện ra màn hình.

>>> BƯỚC 3: TRUY CẬP HỆ THỐNG
- Dành cho Nông dân (Trên điện thoại):
   Truy cập vào đường link Cloudflare vừa copy ở Bước 2.

- Dành cho Ban kỹ thuật/Admin (Trên máy tính):
   Truy cập: http://localhost:8000/admin

