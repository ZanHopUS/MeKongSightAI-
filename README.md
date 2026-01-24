
MEKONGSIGHT AI - HỆ THỐNG GIÁM SÁT MÔI TRƯỜNG ĐA PHƯƠNG THỨC (IoT + AI)

🌱 Mekong Sight AI

Hệ thống hỗ trợ ra quyết định thông minh cho mô hình Luân canh Tôm – Lúa thích ứng Biến đổi Khí hậu tại ĐBSCL

1️⃣ Vấn đề cần giải quyết (The Problem – Impact lớn)

Đồng bằng sông Cửu Long (ĐBSCL) đang là khu vực chịu tổn thương nặng nề nhất bởi biến đổi khí hậu tại Việt Nam, với các hiện tượng ngày càng cực đoan và khó dự đoán như:

Xâm nhập mặn đến sớm hoặc kéo dài bất thường

Nguồn nước ngọt thiếu ổn định theo không gian và thời gian

Nhiệt độ tăng cao gây sốc sinh lý cho cây trồng và vật nuôi

Trong bối cảnh đó, mô hình Luân canh Tôm – Lúa được xem là giải pháp “thuận thiên”, tuy nhiên trên thực tế, nông dân vẫn đang đối mặt với rủi ro rất lớn do:

Thiếu công cụ giám sát môi trường tại chỗ, theo thời gian thực

Quyết định mùa vụ chủ yếu dựa vào kinh nghiệm truyền thống và lịch thời vụ cố định

Không có dữ liệu để phát hiện sớm rủi ro, dẫn đến:

Mất trắng vụ lúa do mặn xâm nhập sớm

Tôm chết hàng loạt do sốc nhiệt, sốc mặn hoặc thiếu oxy

Tăng chi phí thức ăn, thuốc, và ô nhiễm môi trường nước

👉 Vấn đề cốt lõi:

Nông dân đang phải ra quyết định sống còn trong điều kiện thiếu dữ liệu, thiếu cảnh báo sớm và thiếu công cụ hỗ trợ thông minh, trong khi biến đổi khí hậu ngày càng khó lường.

2️⃣ Tổng quan giải pháp (Solution Overview)

Mekong Sight AI là hệ thống hỗ trợ ra quyết định dựa trên dữ liệu dành cho mô hình Luân canh Tôm – Lúa, giúp nông dân chuyển từ “làm theo kinh nghiệm” sang “làm nông dựa trên dữ liệu số”.

Điểm khác biệt của giải pháp:

❌ Không phụ thuộc vào hạ tầng phức tạp hay thiết bị đắt tiền

❌ Không yêu cầu người dùng có kiến thức công nghệ cao

✅ Tập trung vào ngưỡng sinh thái – dữ liệu môi trường – logic ra quyết định

Cách tiếp cận của Mekong Sight AI:

Thu thập và tổng hợp dữ liệu môi trường cốt lõi (độ mặn, nhiệt độ, pH, mực nước)

So sánh dữ liệu thực tế với ngưỡng chịu đựng theo từng giống và từng giai đoạn sinh trưởng

Hiển thị kết quả trực quan – dễ hiểu – hành động được ngay

Ứng dụng AI để:

Phân tích rủi ro

Gợi ý xử lý

Đề xuất lịch thời vụ động, linh hoạt theo điều kiện thực tế thay vì lịch cố định

👉 Triết lý giải pháp:

Không chỉ “đo cho biết”, mà đo để cảnh báo – phân tích – và hỗ trợ quyết định đúng thời điểm.

3️⃣ Các tính năng chính (Key Features)
🔹 1. Giám sát môi trường & Cảnh báo thông minh

Theo dõi các chỉ số môi trường quan trọng:

Độ mặn (‰)

Nhiệt độ (°C)

pH

Mực nước (cm)

Giao diện trực quan dạng đồng hồ đo (Gauge) với 3 mức:

🟢 An toàn

🟡 Cảnh báo

🔴 Nguy hiểm

Hệ thống tự động so sánh dữ liệu với ngưỡng sinh thái phù hợp cho từng giống cây/con

Cảnh báo rõ ràng, dễ hiểu:

“Độ mặn vượt ngưỡng cho lúa ST24/ST25 – Ngưng bơm nước ngay”

🔹 2. Hỗ trợ ra quyết định theo giai đoạn sinh trưởng

Người dùng chọn:

Loại cây trồng / vật nuôi

Giống

Giai đoạn sinh trưởng

Hệ thống tự động điều chỉnh ngưỡng đánh giá rủi ro

Tránh tình trạng:

Áp cùng một ngưỡng cho mọi thời điểm

Đánh giá sai mức độ nguy hiểm

🔹 3. Trợ lý AI phân tích & khuyến nghị

Phân tích tổng hợp dữ liệu môi trường

Đưa ra khuyến nghị hành động:

Đóng/mở cống

Điều chỉnh mực nước

Trì hoãn hoặc đẩy sớm chuyển vụ

Hướng tới lịch thời vụ động:

Thích ứng theo điều kiện thực tế

Giảm rủi ro do biến đổi khí hậu

2. CẤU TRÚC DỰ ÁN (MVC LITE)

MekongSightAI/
 ├── app/                   # Mã nguồn chính (Backend & Frontend)
 │    ├── main.py           # Server xử lý trung tâm (FastAPI)
 │    ├── static/           # Chứa file CSS, JS, Hình ảnh
 │    └── templates/        # Chứa giao diện HTML (Admin & User)
 ├── admin.html             # Web điều chỉnh dữ liệu
 ├── get_link.py            # Tool tự động lấy link Online (Mới)
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
   python get_link.py


>>> BƯỚC 3: TRUY CẬP HỆ THỐNG
Lấy link trong terminal sau khi chạy 

