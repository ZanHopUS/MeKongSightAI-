from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime, json, os, requests, math, random
from datetime import timedelta
from typing import Optional, List, Dict
import google.generativeai as genai
from PIL import Image
import io

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# === AI CONFIG ===
# Thay thế bằng API Key của bạn nếu cần
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyBcFLMarebH0D6mm6fyP3RKdriyFkIP3vc")
try:
    genai.configure(api_key=GOOGLE_API_KEY)
    # Sửa tên model thành phiên bản ổn định hơn
    model = genai.GenerativeModel('gemini-flash-latest')
except Exception as e:
    print(f"⚠️ Gemini AI initialization failed: {e}")

# === DATABASE FILES ===
DB_FILE = "sensor_data.json"
USER_DB_FILE = "users.json"

# === STATION CONFIGURATION (MỚI THÊM) ===
# Định nghĩa trạm nào nuôi con gì để hệ thống phân tích đúng
STATION_CONFIG = {
    "ST-01": {"crop": "rice", "variety": "st25"},      # Sóc Trăng: Lúa
    "ST-02": {"crop": "shrimp", "variety": "tom_su"},  # Bạc Liêu: Tôm Sú
    "ST-03": {"crop": "rice", "variety": "om5451"},    # Kiên Giang: Lúa
    "ST-04": {"crop": "shrimp", "variety": "tom_the"}  # Cà Mau: Tôm Thẻ
}

# === ENHANCED FARMING RULES ===
FARMING_RULES = {
    'rice': {
        'st25': {
            'name': 'Lúa ST24/ST25 (Chịu mặn)',
            'salinity': {'min': 0, 'max': 4.0, 'optimal': [1.0, 2.5]},
            'ph': {'min': 5.5, 'max': 7.5, 'optimal': [6.0, 7.0]},
            'temperature': {'min': 25, 'max': 35, 'optimal': [28, 32]},
            'water': {'min': 5, 'max': 20, 'optimal': [8, 15]},
            'growth_stages': {
                'seedling': {'days': '1-20', 'water': [3, 5], 'salinity_max': 2.0},
                'tillering': {'days': '21-45', 'water': [5, 10], 'salinity_max': 3.0},
                'panicle': {'days': '46-75', 'water': [10, 15], 'salinity_max': 2.5},
                'flowering': {'days': '76-90', 'water': [8, 12], 'salinity_max': 2.0},
                'maturity': {'days': '91-110', 'water': [3, 8], 'salinity_max': 3.5}
            }
        },
        'om5451': {
            'name': 'Lúa OM5451 (Ngọt)',
            'salinity': {'min': 0, 'max': 2.0, 'optimal': [0, 1.0]},
            'ph': {'min': 6.0, 'max': 7.0, 'optimal': [6.2, 6.8]},
            'temperature': {'min': 24, 'max': 34, 'optimal': [27, 31]},
            'water': {'min': 5, 'max': 15, 'optimal': [7, 12]},
            'growth_stages': {
                'seedling': {'days': '1-20', 'water': [5, 8], 'salinity_max': 1.0},
                'tillering': {'days': '21-40', 'water': [8, 12], 'salinity_max': 1.5},
                'panicle': {'days': '41-70', 'water': [10, 15], 'salinity_max': 1.0},
                'flowering': {'days': '71-85', 'water': [8, 12], 'salinity_max': 0.5},
                'maturity': {'days': '86-105', 'water': [5, 10], 'salinity_max': 2.0}
            }
        }
    },
    'shrimp': {
        'tom_su': {
            'name': 'Tôm Sú (Quảng canh)',
            'salinity': {'min': 10, 'max': 30, 'optimal': [15, 25]},
            'ph': {'min': 7.5, 'max': 8.5, 'optimal': [7.8, 8.2]},
            'temperature': {'min': 26, 'max': 32, 'optimal': [28, 30]},
            'water': {'min': 80, 'max': 200, 'optimal': [100, 150]},
            'growth_stages': {
                'postlarval': {'days': '1-30', 'water': [80, 100], 'salinity': [15, 20]},
                'juvenile': {'days': '31-60', 'water': [100, 120], 'salinity': [18, 25]},
                'subadult': {'days': '61-90', 'water': [120, 150], 'salinity': [20, 28]},
                'adult': {'days': '91-120', 'water': [100, 150], 'salinity': [15, 30]}
            }
        },
        'tom_the': {
            'name': 'Tôm Thẻ (Công nghiệp)',
            'salinity': {'min': 15, 'max': 35, 'optimal': [20, 30]},
            'ph': {'min': 7.2, 'max': 8.3, 'optimal': [7.5, 8.0]},
            'temperature': {'min': 25, 'max': 33, 'optimal': [27, 31]},
            'water': {'min': 100, 'max': 200, 'optimal': [120, 180]},
            'growth_stages': {
                'postlarval': {'days': '1-25', 'water': [100, 120], 'salinity': [20, 25]},
                'juvenile': {'days': '26-50', 'water': [120, 150], 'salinity': [22, 30]},
                'subadult': {'days': '51-75', 'water': [150, 180], 'salinity': [25, 32]},
                'adult': {'days': '76-100', 'water': [120, 180], 'salinity': [20, 35]}
            }
        }
    }
}

# === HELPER FUNCTIONS ===
def create_station_template():
    return {
        "current": {
            "salinity": 0, "temperature": 0, "ph": 0, "water_level": 0,
            "is_danger": False, "alert": "Chờ dữ liệu...",
            "timestamp": datetime.datetime.now().isoformat()
        },
        "history": []
    }

def load_data():
    default_data = {
        "stations": { "ST-01": create_station_template(), "ST-02": create_station_template() }
    }
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "stations" not in data: return default_data
                return data
        except: return default_data
    return default_data

def save_data(data):
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e: print(f"Error saving data: {e}")

def load_users():
    default_users = [
        {"username": "user1", "password": "123", "name": "Nông dân A (Sóc Trăng)", "role": "user", "station_id": "ST-01"},
        {"username": "user2", "password": "123", "name": "Nông dân B (Bạc Liêu)", "role": "user", "station_id": "ST-02"},
        {"username": "admin", "password": "123", "name": "Quản trị viên", "role": "admin", "station_id": "ST-01"}
    ]
    if os.path.exists(USER_DB_FILE):
        try:
            with open(USER_DB_FILE, "r", encoding="utf-8") as f: return json.load(f)
        except: return default_users
    return default_users

def save_users(users):
    try:
        with open(USER_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=4, ensure_ascii=False)
    except Exception as e: print(f"Error saving users: {e}")

db = load_data()

# === ENHANCED SMART ANALYSIS ===
def analyze_environment_smart(salinity, ph, temperature, water_level, crop_type='rice', variety='st25', growth_stage=None):
    rules = FARMING_RULES.get(crop_type, {}).get(variety, {})
    if not rules:
        return {
            "status": "UNKNOWN", "level": "info", "advice": ["Chưa có quy tắc"], "detailed_analysis": {}
        }
    
    issues = []
    warnings = []
    recommendations = []
    status = "TỐT"
    level = "success"
    detailed = {}
    
    # Phân tích độ mặn
    sal_rule = rules.get('salinity', {})
    detailed['salinity'] = {'value': salinity, 'status': 'good'}
    if salinity > sal_rule.get('max', 100):
        issues.append(f"🚨 ĐỘ MẶN CAO: {salinity}‰ (ngưỡng {sal_rule['max']}‰)")
        status = "NGUY HIỂM"; level = "danger"; detailed['salinity']['status'] = 'critical'
    elif salinity < sal_rule.get('min', 0):
        warnings.append(f"⚠️ Độ mặn thấp: {salinity}‰")
        if status != "NGUY HIỂM": status = "CẢNH BÁO"; level = "warning"
        detailed['salinity']['status'] = 'low'
    
    # Phân tích pH
    ph_rule = rules.get('ph', {})
    detailed['ph'] = {'value': ph, 'status': 'good'}
    if ph < ph_rule.get('min', 0) or ph > ph_rule.get('max', 14):
        issues.append(f"🚨 pH BẤT THƯỜNG: {ph}"); 
        if status != "NGUY HIỂM": status = "CẢNH BÁO"; level = "warning"
        detailed['ph']['status'] = 'critical'
    
    # Phân tích nhiệt độ
    temp_rule = rules.get('temperature', {})
    detailed['temperature'] = {'value': temperature, 'status': 'good'}
    if temperature > temp_rule.get('max', 100):
        issues.append(f"🌡️ NHIỆT ĐỘ CAO: {temperature}°C")
        if status == "TỐT": status = "CẢNH BÁO"; level = "warning"
        detailed['temperature']['status'] = 'high'
        
    # Phân tích mực nước
    water_rule = rules.get('water', {})
    detailed['water_level'] = {'value': water_level, 'status': 'good'}
    if water_level < water_rule.get('min', 0):
        issues.append(f"💧 MỰC NƯỚC THẤP: {water_level}cm")
        status = "NGUY HIỂM"; level = "danger"; detailed['water_level']['status'] = 'critical'

    if not issues and not warnings: recommendations.append("✅ Môi trường ổn định")
        
    score = 100
    if level == "danger": score -= 40
    elif level == "warning": score -= 20
    detailed['overall_score'] = max(0, score)
    
    return { "status": status, "level": level, "advice": issues + warnings + recommendations, "detailed_analysis": detailed }

# === API ROUTES ===
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request): return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=FileResponse)
async def read_admin(): return FileResponse("admin.html")

# === SENSOR API ===
@app.get("/api/sensor")
async def get_sensor_current(device_id: str = "ST-01"):
    if device_id not in db["stations"]:
        db["stations"][device_id] = create_station_template()
        save_data(db)
    return db["stations"][device_id]["current"]

class SensorData(BaseModel):
    station_id: str; salinity: float; temperature: float; ph: float; water_level: float

@app.post("/api/update-sensor")
async def update_sensor(data: SensorData):
    global db
    sid = data.station_id
    
    if sid not in db["stations"]:
        db["stations"][sid] = create_station_template()
    
    # === SỬA LỖI Ở ĐÂY: Lấy đúng cấu hình cây trồng của trạm ===
    config = STATION_CONFIG.get(sid, {"crop": "rice", "variety": "st25"})
    
    analysis = analyze_environment_smart(
        data.salinity, data.ph, data.temperature, data.water_level,
        crop_type=config["crop"], variety=config["variety"] # Truyền đúng loại cây
    )
    
    timestamp = datetime.datetime.now()
    db["stations"][sid]["current"] = {
        "salinity": round(data.salinity, 1),
        "temperature": round(data.temperature, 1),
        "ph": round(data.ph, 1),
        "water_level": round(data.water_level, 0),
        "is_danger": analysis["level"] == "danger",
        "alert": analysis["status"],
        "timestamp": timestamp.isoformat()
    }
    
    record = {
        "time": timestamp.strftime("%Y-%m-%d %H:%M"),
        "salinity": round(data.salinity, 2),
        "temperature": round(data.temperature, 2),
        "ph": round(data.ph, 2),
        "water_level": round(data.water_level, 1)
    }
    db["stations"][sid]["history"].append(record)
    
    if len(db["stations"][sid]["history"]) > 5000:
        db["stations"][sid]["history"] = db["stations"][sid]["history"][-5000:]
    
    save_data(db)
    return {"status": "ok", "analysis": analysis}

@app.get("/api/analyze")
async def analyze_endpoint(device_id: str = "ST-01", crop_type: str = "rice", variety: str = "st25", growth_stage: Optional[str] = None):
    if device_id not in db["stations"]: return {"status": "error", "message": "Station not found"}
    current = db["stations"][device_id]["current"]
    return analyze_environment_smart(current["salinity"], current["ph"], current["temperature"], current["water_level"], crop_type, variety, growth_stage)

@app.get("/api/sensor-history")
async def get_history(device_id: str = "ST-01", range: str = "24h"):
    if device_id not in db["stations"]: return {"labels": [], "salinity": [], "temperature": [], "ph": [], "water": [], "stats": {}}
    full_history = db["stations"][device_id]["history"]
    if not full_history: return {"labels": [], "salinity": [], "temperature": [], "ph": [], "water": [], "stats": {}}
    
    now = datetime.datetime.now()
    if range == "24h": delta = timedelta(hours=24)
    elif range == "7d": delta = timedelta(days=7)
    elif range == "30d": delta = timedelta(days=30)
    else: delta = timedelta(days=1)
    start_time = now - delta
    
    filtered = [h for h in full_history if datetime.datetime.strptime(h["time"], "%Y-%m-%d %H:%M") >= start_time]
    if not filtered: return {"labels": [], "salinity": [], "temperature": [], "ph": [], "water": [], "stats": {}}

    step = max(1, len(filtered) // 100)
    sampled = filtered[::step]
    
    sal = [h.get("salinity", 0) for h in sampled]
    temp = [h.get("temperature", 0) for h in sampled]
    ph = [h.get("ph", 7) for h in sampled]
    water = [h.get("water_level", 0) for h in sampled]
    
    def calc_stats(data):
        if not data: return {"avg": 0, "min": 0, "max": 0}
        return {"avg": round(sum(data) / len(data), 1), "min": round(min(data), 1), "max": round(max(data), 1)}

    return {
        "labels": [h["time"] for h in sampled],
        "salinity": sal, "temperature": temp, "ph": ph, "water": water,
        "stats": { "salinity": calc_stats(sal), "temperature": calc_stats(temp), "ph": calc_stats(ph), "water": calc_stats(water) }
    }

# === WEATHER API ===
LOCATIONS = {
    "ST-01": {"lat": 9.60, "lon": 105.97, "name": "Sóc Trăng"},
    "ST-02": {"lat": 9.29, "lon": 105.72, "name": "Bạc Liêu"},
    "ST-03": {"lat": 10.01, "lon": 105.08, "name": "Kiên Giang"}, 
    "ST-04": {"lat": 9.17, "lon": 105.15, "name": "Cà Mau"}
}

@app.get("/api/weather-schedule")
async def get_weather(device_id: str = "ST-01"):
    loc = LOCATIONS.get(device_id, LOCATIONS["ST-01"])
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={loc['lat']}&longitude={loc['lon']}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&past_days=7&forecast_days=7&current_weather=true&timezone=Asia%2FBangkok"
        res = requests.get(url, timeout=5).json()
        current = res.get("current_weather", {})
        daily = res.get("daily", {})
        
        tide_levels = []
        chart_dates = daily.get("time", [])
        for i in range(len(chart_dates)):
            val = 1.8 + math.sin(i * 0.3) * 1.2
            tide_levels.append(round(abs(val), 1))
            
        return {
            "status": "ok",
            "weather": {
                "temp": current.get("temperature", 30),
                "desc": "Nắng đẹp" if current.get("weathercode", 0) < 3 else "Có mây/Mưa",
                "chart_dates": chart_dates,
                "chart_temps_max": daily.get("temperature_2m_max", []),
                "chart_temps_min": daily.get("temperature_2m_min", []),
                "chart_rain": daily.get("precipitation_sum", [])
            },
            "tide": {
                "level": f"{tide_levels[-1]}m", "advice": "Triều đang lên", "color": "green", "chart_data": tide_levels
            }
        }
    except: return {"status": "error"}

@app.get("/api/weather-prediction")
async def get_weather_prediction(device_id: str = "ST-01"):
    weather_data = await get_weather(device_id)
    if weather_data["status"] != "ok": return {"prediction": "Không thể lấy dữ liệu thời tiết."}
    
    try:
        # 1. Lấy thông tin cây trồng từ cấu hình trạm (để AI khuyên đúng việc)
        station_info = STATION_CONFIG.get(device_id, {"crop": "rice"})
        crop_type = "Lúa" if station_info["crop"] == "rice" else "Tôm"
        
        # 2. Chuẩn bị dữ liệu
        w = weather_data["weather"]
        max_temp = max(w['chart_temps_max'])
        total_rain = sum(w['chart_rain'])
        
        # 3. Prompt chuyên nghiệp (Kỹ thuật Prompt Engineering)
        prompt = f"""
        Bạn là Kỹ sư Nông nghiệp chuyên về canh tác {crop_type} tại Đồng Bằng Sông Cửu Long.
        Dữ liệu thời tiết tại trạm giám sát:
        - Hiện tại: {w['temp']}°C ({w['desc']})
        - Dự báo 7 ngày tới: Nhiệt độ đỉnh điểm {max_temp}°C, Tổng lượng mưa {total_rain}mm.

        Nhiệm vụ: Hãy đưa ra đúng 01 lời khuyên kỹ thuật quan trọng nhất, cấp thiết nhất cho bà con nông dân ngay lúc này.
        Yêu cầu:
        - Ngắn gọn (dưới 40 từ).
        - Dùng từ ngữ chuyên môn nhưng dễ hiểu (ví dụ: 'chạy quạt', 'xả phèn', 'bón đón đòng'...).
        - Giọng văn: Cảnh báo hoặc Khuyến nghị hành động.
        """
        
        res = model.generate_content(prompt)
        return {"prediction": res.text.strip()}
    except Exception as e:
        print(f"AI Error: {e}")
        return {"prediction": "Hệ thống AI đang bận phân tích, vui lòng thử lại sau."}

# === LOGIN API & AI IMAGE ===
class LoginData(BaseModel):
    username: str
    password: str
@app.post("/api/login")
async def login(data: LoginData):
    users = load_users()
    for u in users:
        if u['username'] == data.username and u['password'] == data.password:
            return {"status": "ok", "msg": u['name'], "station_id": u.get("station_id", "ST-01"), "role": u.get("role", "user")}
    return {"status": "error", "msg": "Sai thông tin"}


@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not GOOGLE_API_KEY: 
        return {"status": "error", "msg": "Thiếu API Key", "solution": ""}
    
    try:
        # 1. Đọc và xử lý ảnh
        img = Image.open(io.BytesIO(await file.read()))
        
        # 2. Xây dựng Prompt chuyên sâu (Prompt Engineering)
        prompt = """
        Vai trò: Bạn là Chuyên gia Bác sĩ Nông nghiệp (AI Plant Pathologist) với 20 năm kinh nghiệm về Lúa và Tôm tại Đồng Bằng Sông Cửu Long.
        
        Nhiệm vụ: Hãy quan sát kỹ hình ảnh được cung cấp và thực hiện các bước sau:
        1. Xác định đối tượng: Là cây Lúa, con Tôm, hay môi trường nước? (Nếu không phải ảnh nông nghiệp, hãy báo lỗi).
        2. Chẩn đoán: Tìm kiếm các dấu hiệu bệnh (đốm lá, rầy nâu, hoại tử gan tụy, đốm trắng...).
        3. Đề xuất: Đưa ra phác đồ điều trị cụ thể hoặc biện pháp phòng ngừa.

        Yêu cầu đầu ra: Chỉ trả về 1 chuỗi JSON duy nhất (không Markdown) theo định dạng sau:
        {
            "status": "healthy" (nếu khỏe) | "diseased" (nếu bệnh) | "pest" (nếu có sâu hại) | "unknown" (nếu không nhận diện được),
            "msg": "Tên bệnh/Vấn đề ngắn gọn (Ví dụ: Bệnh Đạo Ôn, Tôm bị đốm trắng)",
            "solution": "Lời khuyên kỹ thuật chi tiết (tối đa 3 câu). Ví dụ: Sử dụng thuốc đặc trị nấm đạo ôn gốc Tricyclazole, phun vào sáng sớm."
        }
        """
        
        # 3. Gửi yêu cầu cho AI
        res = model.generate_content([prompt, img])
        
        # 4. Xử lý kết quả trả về (Làm sạch chuỗi JSON)
        text = res.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
        
    except Exception as e:
        print(f"AI Image Error: {e}")
        return {
            "status": "unknown", 
            "msg": "Không thể phân tích ảnh này", 
            "solution": "Vui lòng chụp lại ảnh rõ nét hơn hoặc kiểm tra kết nối mạng."
        }

# === ADMIN API ===
@app.get("/api/admin/users")
async def get_users(): return load_users()

@app.get("/api/admin/sensor-data")
async def get_sensor_data(): return db
class UserCreate(BaseModel): username: str; password: str; name: str; role: str; station_id: str

@app.post("/api/admin/add-user")
async def add_user(user: UserCreate):
    users = load_users(); users.append(user.dict()); save_users(users); return {"status": "ok"}

@app.delete("/api/admin/delete-user/{username}")
async def delete_user(username: str):
    users = load_users(); users = [u for u in users if u["username"] != username]; save_users(users); return {"status": "ok"}

@app.delete("/api/admin/clear-history/{station_id}")
async def clear_history(station_id: str):
    if station_id in db["stations"]: db["stations"][station_id]["history"] = []; save_data(db); return {"status": "ok"}

@app.post("/api/admin/add-station")
async def add_station(data: dict):
    sid = data.get("station_id"); 
    if sid and sid not in db["stations"]: db["stations"][sid] = create_station_template(); save_data(db)
    return {"status": "ok"}