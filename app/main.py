from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime, random, requests, asyncio, math
import json
import os
import google.generativeai as genai
from PIL import Image
import io

app = FastAPI()

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Cấu hình đường dẫn tĩnh
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# === CẤU HÌNH AI (Thay Key của bạn vào đây) ===
GOOGLE_API_KEY = "AIzaSyAMlaUxEsQV1ilSwKMEgtQWqXWk877dZTE" 
try:
    genai.configure(api_key=GOOGLE_API_KEY)
    # Dùng model ổn định nhất
    model = genai.GenerativeModel('gemini-flash-latest')
except:
    print("⚠️ Cảnh báo: Chưa cấu hình API Key hoặc lỗi kết nối AI")


# 1. LOGIC LƯU TRỮ DỮ LIỆU (DATABASE MINI)

DB_FILE = "sensor_data.json"

# Dữ liệu mặc định (Dùng khi mới chạy lần đầu)
default_status = {
    "salinity": 0, "temperature": 0, "ph": 0, 
    "water_level": 120, "is_danger": False, "alert": ""
}

def load_data():
    """Đọc dữ liệu từ file JSON khi khởi động"""
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                data = json.load(f)
                print(f"✅ Đã khôi phục dữ liệu: {data}")
                return data
        except Exception as e:
            print(f"⚠️ Lỗi đọc file data: {e}")
    return default_status.copy()

def save_data(data):
    """Lưu dữ liệu vào file JSON mỗi khi có cập nhật"""
    try:
        with open(DB_FILE, "w") as f:
            json.dump(data, f)
    except Exception as e:
        print(f"⚠️ Không thể lưu dữ liệu: {e}")

# Biến toàn cục (Load từ file ngay khi chạy)
current_status = load_data()



# 2. API GIAO DIỆN

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def read_admin(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

# 3. API DỮ LIỆU THÔNG MINH

@app.get("/api/get-status")
async def get_status():
    return current_status

# Class dữ liệu đầu vào (Cho phép thiếu trường water_level)
class SensorData(BaseModel):
    station_id: str
    salinity: float
    temperature: float
    ph: float
    # Logic mới: Nếu thiết bị cũ không gửi mực nước, tự động điền 120
    water_level: float = 120.0 

@app.post("/api/update-sensor")
async def update_sensor(data: SensorData):
    global current_status
    
    # Logic cảnh báo đa điều kiện
    is_danger = False
    alert_msg = "Môi trường ổn định"
    
    # Điều kiện 1: Độ mặn cao
    if data.salinity > 4.0:
        is_danger = True
        alert_msg = f"Nguy hiểm! Độ mặn cao ({data.salinity}‰)"
    
    # Điều kiện 2: Mực nước quá thấp (Dễ gây nóng nước và tăng mặn)
    if data.water_level < 50:
        is_danger = True
        alert_msg = "Cảnh báo! Mực nước quá thấp (Cạn)"
    
    current_status = {
        "salinity": round(data.salinity, 1),
        "temperature": round(data.temperature, 1),
        "ph": round(data.ph, 1),
        "water_level": round(data.water_level, 0),
        "is_danger": is_danger,
        "alert": alert_msg
    }
    
    # Tự động lưu xuống ổ cứng
    save_data(current_status)
    
    return {"status": "ok", "saved": True}

# 4. API THỜI TIẾT

LOCATIONS = {
    "ST-01": {"name": "Sóc Trăng", "lat": 9.60, "lon": 105.97},
    "BL-02": {"name": "Bạc Liêu", "lat": 9.29, "lon": 105.72}, 
}

def get_real_weather(lat, lon):
    try:
        # Timeout 3s: Nếu mạng lag quá 3s thì tự cắt để không treo App
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&timezone=Asia%2FBangkok"
        res = requests.get(url, timeout=3).json()
        temp = res['current_weather']['temperature']
        code = res['current_weather']['weathercode']
        desc = "Nắng đẹp"
        if code > 3: desc = "Có mây/Mưa"
        return {"temp": temp, "desc": desc}
    except:
        # Fallback: Trả về dữ liệu giả lập nếu mất mạng
        print("⚠️ Mất mạng: Đang dùng dữ liệu giả lập")
        return {"temp": 30.5, "desc": "Giả lập (Offline)"}

def get_tide_forecast():
    today = datetime.date.today()
    cycle = math.sin(today.day * 0.5)
    
    return {
        "date": today.strftime("%d/%m/%Y"),
        "status": "TRIỀU CƯỜNG" if cycle > 0.4 else "BÌNH THƯỜNG",
        "level": "Cao (2.9m)" if cycle > 0.4 else "Thấp (1.1m)",
        "color": "red" if cycle > 0.4 else "green",
        "advice": "⚠️ Cần gia cố đê bao" if cycle > 0.4 else "✅ Có thể lấy nước"
    }

@app.get("/api/weather-schedule")
async def get_weather_schedule(device_id: str = "ST-01"):
    loc = LOCATIONS.get(device_id, LOCATIONS["ST-01"])
    weather = get_real_weather(loc['lat'], loc['lon'])
    tide = get_tide_forecast()
    return {
        "location_name": loc['name'], # Khớp với frontend cũ của bạn
        "weather": weather,
        "tide": tide
    }

# 5. API AI (XỬ LÝ LỖI THÔNG MINH)

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    # Kiểm tra xem có Key chưa
    if not GOOGLE_API_KEY:
        return {"status": "error", "msg": "Chưa có API Key", "solution": "Liên hệ Admin cấu hình lại."}

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        prompt = """
        Đóng vai là một Chuyên gia Nông nghiệp và Thủy sản hàng đầu tại Đồng bằng sông Cửu Long.
        Nhiệm vụ của bạn là phân tích hình ảnh đầu vào để hỗ trợ nông dân chẩn đoán bệnh cho: LÚA, TÔM, hoặc CÁ.

        Hãy thực hiện các bước suy luận sau:
        1. NHẬN DIỆN: Đây là Lúa, Tôm, hay Cá? (Nếu không phải 3 loại này, trả về unknown).
        2. QUAN SÁT TRIỆU CHỨNG:
           - Nếu là Lúa: Tìm các đốm nâu (đạo ôn), vệt vàng (cháy bìa lá), sâu cuốn lá, rầy nâu...
           - Nếu là Tôm: Quan sát màu sắc gan tụy, ruột, vỏ (đốm trắng), cơ thịt (đục cơ).
           - Nếu là Cá: Quan sát vây, mang, da (xuất huyết, nấm, lở loét).
        3. KẾT LUẬN: Đưa ra chẩn đoán chính xác nhất.

        Yêu cầu trả về kết quả dưới dạng JSON thuần túy (tuyệt đối không dùng Markdown, không dùng ```json):
        {
            "status": "healthy" (nếu khỏe) hoặc "sick" (nếu có dấu hiệu bệnh),
            "msg": "Tên đối tượng + Tên bệnh cụ thể (Ví dụ: 'Tôm thẻ bị hoại tử gan tụy', 'Lúa bị đạo ôn cổ bông')",
            "solution": "Giải pháp kỹ thuật ngắn gọn, hiệu quả (Dưới 20 từ, ví dụ: 'Thay nước, tạt khoáng', 'Phun thuốc Beam 75WP')"
        }

        Trường hợp không xác định được hoặc ảnh mờ, hãy trả về:
        {
            "status": "unknown", 
            "msg": "Ảnh không rõ ràng hoặc không đúng đối tượng", 
            "solution": "Vui lòng chụp lại cận cảnh vùng bị bệnh"
        }
        """

        response = model.generate_content([prompt, image])
        
        # Làm sạch kết quả trả về (đề phòng AI vẫn thêm markdown)
        text_res = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text_res)

    except Exception as e:
        print(f"❌ Lỗi AI: {e}")
        return {
            "status": "sick", 
            "msg": "⚠️ Lỗi kết nối AI", 
            "solution": "Vui lòng kiểm tra lại mạng wifi/4G."
        }

# In thông báo khi chạy
print("🚀 Backend MekongSight AI (Logic V2) đang chạy...")


USER_DB_FILE = "users.json"

def load_users():
    """Hàm đọc danh sách người dùng từ file"""
    if os.path.exists(USER_DB_FILE):
        try:
            with open(USER_DB_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"⚠️ Lỗi đọc file user: {e}")
    
    # Nếu file không tồn tại, tạo tài khoản mặc định
    default_users = [
        {"username": "admin", "password": "123", "name": "Admin Mặc định", "role": "admin"}
    ]
    # Tự động tạo file nếu chưa có
    try:
        with open(USER_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(default_users, f, indent=4, ensure_ascii=False)
    except: pass
    
    return default_users

class LoginData(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(data: LoginData):
    # 1. Đọc danh sách mới nhất từ file json
    users = load_users()
    
    # 2. Duyệt qua từng người để tìm tài khoản khớp
    for user in users:
        if user['username'] == data.username and user['password'] == data.password:
            # Tìm thấy! Trả về thành công kèm tên người dùng
            return {
                "status": "ok", 
                "msg": f"Xin chào, {user['name']}!", 
                "username": user['username'],
                "role": user['role']
            }
            
    # 3. Quét hết danh sách mà không khớp ai
    return {"status": "error", "msg": "Sai tài khoản hoặc mật khẩu!"}