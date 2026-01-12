import requests
import time
import random
import json

# Địa chỉ Server (Backend)
SERVER_URL = "http://127.0.0.1:8000/api/update-sensor"

print("📡 ĐANG KHỞI ĐỘNG CẢM BIẾN IOT GIẢ LẬP...")
print(f"🎯 Mục tiêu gửi: {SERVER_URL}")

# Trạng thái ban đầu
current_salinity = 1.5
current_temp = 29.5
current_ph = 7.5
current_water = 120

while True:
    try:
        # 1. Tạo dao động ngẫu nhiên (để số liệu nhảy múa cho sinh động)
        current_salinity += random.uniform(-0.2, 0.3)
        current_temp += random.uniform(-0.1, 0.1)
        current_ph += random.uniform(-0.05, 0.05)
        current_water += random.uniform(-1, 1)

        # Giới hạn số liệu không cho âm hoặc quá cao
        if current_salinity < 0: current_salinity = 0
        if current_water < 0: current_water = 0
        
        # 2. Đóng gói dữ liệu
        payload = {
            "station_id": "ST-01",
            "salinity": round(current_salinity, 1),
            "temperature": round(current_temp, 1),
            "ph": round(current_ph, 1),
            "water_level": int(current_water)
        }

        # 3. Gửi lên Server
        response = requests.post(SERVER_URL, json=payload, timeout=2)
        
        if response.status_code == 200:
            print(f"✅ Đã gửi: Mặn={payload['salinity']} | Nước={payload['water_level']}cm | Temp={payload['temperature']}")
        else:
            print(f"⚠️ Lỗi Server: {response.status_code}")

    except Exception as e:
        print(f"❌ Mất kết nối tới Server: {e}")
        print("   -> Đang thử lại...")

    # Nghỉ 2 giây rồi gửi tiếp
    time.sleep(2)