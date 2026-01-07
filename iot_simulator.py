import requests
import time
import random

# Địa chỉ IP máy tính của bạn (Hãy thay đổi nếu IP thay đổi)
# Lưu ý: Giữ nguyên port 8000 và đường dẫn /api/update-sensor
API_URL = "http://127.0.0.1:8000/api/update-sensor" 
# Nếu chạy trên điện thoại thì nhớ đổi 127.0.0.1 thành IP máy tính (ví dụ 172.20.10.3)

def generate_fake_data():
    print(f"⏳ Đang đo đạc... (Gửi dữ liệu lúc {time.strftime('%H:%M:%S')})")
    
    # Tỉ lệ 10% xảy ra sự cố (để test cảnh báo)
    is_shock = random.random() < 0.1 
    
    if is_shock:
        return {
            "station_id": "ST-01",
            "salinity": random.uniform(5.0, 15.0), # Mặn cao
            "temperature": random.uniform(34.0, 38.0), # Nóng
            "ph": random.uniform(4.0, 5.0) # Phèn
        }
    else:
        return {
            "station_id": "ST-01",
            "salinity": random.uniform(0.5, 2.5), # Bình thường
            "temperature": random.uniform(28.0, 32.0),
            "ph": random.uniform(7.0, 8.5)
        }

# --- VÒNG LẶP CHÍNH ---
while True:
    data = generate_fake_data()
    try:
        response = requests.post(API_URL, json=data)
        if response.status_code == 200:
            print("✅ Đã gửi dữ liệu thành công!")
            print("💤 Hệ thống sẽ ngủ đông 1 phút để tiết kiệm pin...")
        else:
            print(f"❌ Lỗi Server: {response.status_code}")
    except Exception as e:
        print("❌ Không kết nối được Server (Kiểm tra xem backend.py đã chạy chưa?)")
        
    # QUAN TRỌNG: Ngủ 15 giây
    time.sleep(15)