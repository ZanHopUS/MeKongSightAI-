# app/main.py  (FASTAPI - merged & complete)
from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import (
    HTMLResponse,
    FileResponse,
    RedirectResponse,
    Response,
)
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime, json, os, requests, math
from datetime import timedelta
from typing import Optional
import google.generativeai as genai
from PIL import Image
import io
from pathlib import Path

# ✅ Added from Flask version: bcrypt hashing/checking
# pip install bcrypt
import bcrypt

from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

# ===== PATHS =====
ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT / "app" / "static"
TEMPLATES_DIR = ROOT / "app" / "templates"

# ===== MIDDLEWARE / STATIC / TEMPLATES =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# ✅ NO-CACHE for HTML pages (fix "giao diện cũ" do caching)
class NoCacheHTMLMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        content_type = response.headers.get("content-type", "")
        if "text/html" in content_type:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

app.add_middleware(NoCacheHTMLMiddleware)

# ===== AI CONFIG =====
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "AIzaSyB-u6StR2DNaP0waA5D9UvV8Y9DzB9vYYI")
model = None
try:
    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel("gemini-flash-latest")
except Exception as e:
    print(f"⚠️ Gemini AI initialization failed: {e}")

# ===== DATABASE FILES =====
DB_FILE = str(ROOT / "sensor_data.json")

# ✅ Unify user database file (use one file only)
USER_DB_FILE = str(ROOT / "users.json")

# ===== STATION CONFIGURATION =====
STATION_CONFIG = {
    "ST-01": {"crop": "rice", "variety": "st25"},
    "ST-02": {"crop": "shrimp", "variety": "tom_su"},
    "ST-03": {"crop": "rice", "variety": "om5451"},
    "ST-04": {"crop": "shrimp", "variety": "tom_the"},
    "ST-05": {"crop": "shrimp", "variety": "tom_cang_xanh"},
}

# ===== FARMING RULES (GIỮ NGUYÊN) =====
FARMING_RULES = {
    "rice": {
        "st25": {
            "name": "Lúa ST24/ST25",
            "salinity": {"min": 0, "max": 4.0, "optimal": [1.0, 2.5]},
            "ph": {"min": 5.5, "max": 7.5, "optimal": [6.0, 7.0]},
            "temperature": {"min": 25, "max": 35, "optimal": [28, 32]},
            "water": {"min": 5, "max": 20, "optimal": [8, 15]},
            "growth_stages": {
                "seedling": {
                    "days": "1-20",
                    "salinity_max": 2.0,
                    "ph_range": [5.5, 7.0],
                    "temp_range": [26, 32],
                    "water": [3, 5],
                    "sensitive": True,
                    "risk_note": "Giai đoạn mạ rất nhạy mặn",
                    "action": "Không lấy nước khi mặn > 2‰",
                },
                "panicle": {
                    "days": "46-75",
                    "salinity_max": 2.5,
                    "ph_range": [6.0, 7.0],
                    "temp_range": [28, 32],
                    "water": [10, 15],
                    "sensitive": True,
                    "risk_note": "Làm đòng gặp mặn gây lép",
                    "action": "Giữ nước ngọt tuyệt đối",
                },
                "maturity": {
                    "days": "91-110",
                    "salinity_max": 3.5,
                    "ph_range": [6.0, 7.5],
                    "temp_range": [25, 35],
                    "water": [3, 8],
                    "sensitive": False,
                    "risk_note": "Chịu mặn tốt hơn",
                    "action": "Chuẩn bị thu hoạch",
                },
            },
        }
    },
    "shrimp": {
        "tom_su": {
            "name": "Tôm Sú",
            "salinity": {"min": 5, "max": 35, "optimal": [15, 25]},
            "ph": {"min": 7.0, "max": 9.0, "optimal": [7.8, 8.5]},
            "temperature": {"min": 18, "max": 33, "optimal": [28, 30]},
            "water": {"min": 80, "max": 200, "optimal": [100, 150]},
            "growth_stages": {
                "postlarval": {
                    "days": "1-30",
                    "salinity": [15, 20],
                    "ph_range": [7.8, 8.5],
                    "temp_range": [28, 30],
                    "water": [80, 100],
                    "oxygen_risk": "high",
                    "risk_note": "Tôm con dễ sốc môi trường",
                    "action": "Ổn định nước, chạy quạt liên tục",
                },
                "juvenile": {
                    "days": "31-60",
                    "salinity": [18, 25],
                    "ph_range": [7.5, 8.5],
                    "temp_range": [27, 31],
                    "water": [100, 120],
                    "oxygen_risk": "medium",
                    "risk_note": "Tôm tăng trưởng nhanh",
                    "action": "Theo dõi pH ngày đêm",
                },
                "adult": {
                    "days": "61-120",
                    "salinity": [15, 30],
                    "ph_range": [7.5, 8.8],
                    "temp_range": [26, 32],
                    "water": [120, 150],
                    "oxygen_risk": "medium",
                    "risk_note": "Tôm chịu đựng tốt hơn",
                    "action": "Duy trì nước ổn định",
                },
            },
        },
        "tom_the": {
            "name": "Tôm Chân Trắng",
            "salinity": {"min": 5, "max": 35, "optimal": [20, 30]},
            "ph": {"min": 7.0, "max": 9.0, "optimal": [7.5, 8.2]},
            "temperature": {"min": 18, "max": 33, "optimal": [27, 31]},
            "water": {"min": 80, "max": 200, "optimal": [120, 180]},
            "growth_stages": {
                "postlarval": {
                    "days": "1-25",
                    "salinity": [20, 25],
                    "ph_range": [7.8, 8.2],
                    "temp_range": [28, 30],
                    "water": [100, 120],
                    "oxygen_risk": "very_high",
                    "risk_note": "Tôm chân trắng cực kỳ nhạy",
                    "action": "Chạy quạt mạnh, tránh thay nước đột ngột",
                },
                "juvenile": {
                    "days": "26-50",
                    "salinity": [22, 30],
                    "ph_range": [7.5, 8.2],
                    "temp_range": [27, 31],
                    "water": [120, 150],
                    "oxygen_risk": "high",
                    "risk_note": "Dễ sốc pH – nhiệt",
                    "action": "Giữ pH ổn định, bổ sung khoáng",
                },
                "adult": {
                    "days": "51-100",
                    "salinity": [20, 35],
                    "ph_range": [7.5, 8.5],
                    "temp_range": [26, 32],
                    "water": [150, 180],
                    "oxygen_risk": "medium",
                    "risk_note": "Ổn định hơn nhưng vẫn nhạy",
                    "action": "Theo dõi oxy ban đêm",
                },
            },
        },
        "tom_cang_xanh": {
            "name": "Tôm Càng Xanh",
            "salinity": {"min": 0, "max": 5, "optimal": [0, 2]},
            "ph": {"min": 7.0, "max": 8.5, "optimal": [7.5, 8.0]},
            "temperature": {"min": 29, "max": 31, "optimal": [29.5, 30.5]},
            "water": {"min": 60, "max": 120, "optimal": [70, 100]},
            "growth_stages": {
                "juvenile": {
                    "days": "1-60",
                    "salinity": [0, 2],
                    "ph_range": [7.5, 8.0],
                    "temp_range": [29, 31],
                    "water": [60, 80],
                    "oxygen_risk": "medium",
                    "risk_note": "Thích nước tĩnh, sạch",
                    "action": "Tránh xáo trộn ao",
                },
                "adult": {
                    "days": "61-150",
                    "salinity": [0, 5],
                    "ph_range": [7.0, 8.5],
                    "temp_range": [28, 32],
                    "water": [80, 120],
                    "oxygen_risk": "low",
                    "risk_note": "Chịu đựng tốt",
                    "action": "Giữ nước ổn định",
                },
            },
        },
    },
}

# ===== HELPERS =====
def create_station_template():
    return {
        "current": {
            "salinity": 0,
            "temperature": 0,
            "ph": 0,
            "water_level": 0,
            "is_danger": False,
            "alert": "Chờ dữ liệu...",
            "timestamp": datetime.datetime.now().isoformat(),
        },
        "history": [],
    }

def load_data():
    default_data = {"stations": {sid: create_station_template() for sid in STATION_CONFIG}}
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "stations" not in data:
                    return default_data
                return data
        except Exception:
            return default_data
    return default_data

def save_data(data):
    try:
        with open(DB_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving data: {e}")

# ✅ bcrypt helpers
def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def load_users():
    default_users = [
        {"username": "user1", "password": "123", "name": "Nông dân A (Sóc Trăng)", "role": "user", "station_id": "ST-01"},
        {"username": "user2", "password": "123", "name": "Nông dân B (Bạc Liêu)", "role": "user", "station_id": "ST-02"},
        {"username": "admin", "password": "123", "name": "Quản trị viên", "role": "admin", "station_id": "ST-01"},
    ]
    if os.path.exists(USER_DB_FILE):
        try:
            with open(USER_DB_FILE, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if not content:
                    return default_users
                users = json.loads(content)
                if isinstance(users, list) and users:
                    return users
                return default_users
        except Exception:
            return default_users
    return default_users

def save_users(users):
    try:
        with open(USER_DB_FILE, "w", encoding="utf-8") as f:
            json.dump(users, f, indent=4, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving users: {e}")

def _maybe_migrate_passwords(users: list) -> bool:
    changed = False
    for u in users:
        pw = u.get("password", "")
        if isinstance(pw, str) and pw and not pw.startswith("$2"):
            u["password"] = _hash_password(pw)
            changed = True
    return changed

db = load_data()

# ===== SMART ANALYSIS =====
def analyze_environment_smart(
    salinity, ph, temperature, water_level, crop_type="rice", variety="st25", growth_stage=None
):
    rules = FARMING_RULES.get(crop_type, {}).get(variety, {})
    if not rules:
        return {"status": "UNKNOWN", "level": "info", "advice": ["Chưa có quy tắc"], "detailed_analysis": {}}

    issues, warnings, recommendations = [], [], []
    status, level = "TỐT", "success"
    detailed = {}

    sal_rule = rules.get("salinity", {})
    detailed["salinity"] = {"value": salinity, "status": "good"}
    if salinity > sal_rule.get("max", 100):
        issues.append(f"🚨 ĐỘ MẶN CAO: {salinity}‰ (ngưỡng {sal_rule['max']}‰)")
        status, level = "NGUY HIỂM", "danger"
        detailed["salinity"]["status"] = "critical"
    elif salinity < sal_rule.get("min", 0):
        warnings.append(f"⚠️ Độ mặn thấp: {salinity}‰")
        if status != "NGUY HIỂM":
            status, level = "CẢNH BÁO", "warning"
        detailed["salinity"]["status"] = "low"

    ph_rule = rules.get("ph", {})
    detailed["ph"] = {"value": ph, "status": "good"}
    if ph < ph_rule.get("min", 0) or ph > ph_rule.get("max", 14):
        issues.append(f"🚨 pH BẤT THƯỜNG: {ph}")
        if status != "NGUY HIỂM":
            status, level = "CẢNH BÁO", "warning"
        detailed["ph"]["status"] = "critical"

    temp_rule = rules.get("temperature", {})
    detailed["temperature"] = {"value": temperature, "status": "good"}
    if temperature > temp_rule.get("max", 100):
        issues.append(f"🌡️ NHIỆT ĐỘ CAO: {temperature}°C")
        if status == "TỐT":
            status, level = "CẢNH BÁO", "warning"
        detailed["temperature"]["status"] = "high"

    water_rule = rules.get("water", {})
    detailed["water_level"] = {"value": water_level, "status": "good"}
    if water_level < water_rule.get("min", 0):
        issues.append(f"💧 MỰC NƯỚC THẤP: {water_level}cm")
        status, level = "NGUY HIỂM", "danger"
        detailed["water_level"]["status"] = "critical"

    if not issues and not warnings:
        recommendations.append("✅ Môi trường ổn định")

    score = 100 - (40 if level == "danger" else 20 if level == "warning" else 0)
    detailed["overall_score"] = max(0, score)

    return {
        "status": status,
        "level": level,
        "advice": issues + warnings + recommendations,
        "detailed_analysis": detailed,
    }

# =========================
# ===== PAGE ROUTES =======
# =========================

@app.get("/", response_class=HTMLResponse)
async def guest_page(request: Request):
    return templates.TemplateResponse("guest.html", {"request": request})

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# ✅ FIX: render bằng TemplateResponse để tránh cache + đúng chuẩn FastAPI
@app.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    register_file = TEMPLATES_DIR / "register.html"
    if register_file.exists():
        return templates.TemplateResponse("register.html", {"request": request})
    return RedirectResponse(url="/login?mode=register", status_code=302)

@app.get("/admin")
async def admin_page(request: Request):
    admin_file = TEMPLATES_DIR / "admin.html"
    if admin_file.exists():
        return templates.TemplateResponse("admin.html", {"request": request})
    return RedirectResponse(url="/login", status_code=302)

@app.get("/hybridaction/zybTrackerStatisticsAction")
async def ignore_tracker():
    return Response(status_code=204)

# =========================
# ===== SENSOR API ========
# =========================

@app.get("/api/sensor")
async def get_sensor_current(device_id: str = "ST-01"):
    if device_id not in db["stations"]:
        db["stations"][device_id] = create_station_template()
        save_data(db)
    return db["stations"][device_id]["current"]

class SensorData(BaseModel):
    station_id: str
    salinity: float
    temperature: float
    ph: float
    water_level: float

@app.post("/api/update-sensor")
async def update_sensor(data: SensorData):
    global db
    sid = data.station_id

    if sid not in db["stations"]:
        db["stations"][sid] = create_station_template()

    config = STATION_CONFIG.get(sid, {"crop": "rice", "variety": "st25"})
    analysis = analyze_environment_smart(
        data.salinity, data.ph, data.temperature, data.water_level,
        crop_type=config["crop"], variety=config["variety"]
    )

    timestamp = datetime.datetime.now()
    db["stations"][sid]["current"] = {
        "salinity": round(data.salinity, 1),
        "temperature": round(data.temperature, 1),
        "ph": round(data.ph, 1),
        "water_level": round(data.water_level, 0),
        "is_danger": analysis["level"] == "danger",
        "alert": analysis["status"],
        "timestamp": timestamp.isoformat(),
    }

    record = {
        "time": timestamp.strftime("%Y-%m-%d %H:%M"),
        "salinity": round(data.salinity, 2),
        "temperature": round(data.temperature, 2),
        "ph": round(data.ph, 2),
        "water_level": round(data.water_level, 1),
    }
    db["stations"][sid]["history"].append(record)

    if len(db["stations"][sid]["history"]) > 5000:
        db["stations"][sid]["history"] = db["stations"][sid]["history"][-5000:]

    save_data(db)
    return {"status": "ok", "analysis": analysis}

@app.get("/api/analyze")
async def analyze_endpoint(
    device_id: str = "ST-01",
    crop_type: str = "rice",
    variety: str = "st25",
    growth_stage: Optional[str] = None,
):
    if device_id not in db["stations"]:
        return {"status": "error", "message": "Station not found"}
    current = db["stations"][device_id]["current"]
    return analyze_environment_smart(
        current["salinity"], current["ph"], current["temperature"], current["water_level"],
        crop_type, variety, growth_stage
    )

@app.get("/api/sensor-history")
async def get_history(device_id: str = "ST-01", range: str = "24h"):
    if device_id not in db["stations"]:
        return {"labels": [], "salinity": [], "temperature": [], "ph": [], "water": [], "stats": {}}

    full_history = db["stations"][device_id]["history"]
    if not full_history:
        return {"labels": [], "salinity": [], "temperature": [], "ph": [], "water": [], "stats": {}}

    now = datetime.datetime.now()
    if range == "24h":
        delta = timedelta(hours=24)
    elif range == "7d":
        delta = timedelta(days=7)
    elif range == "30d":
        delta = timedelta(days=30)
    else:
        delta = timedelta(days=1)

    start_time = now - delta
    filtered = [
        h for h in full_history
        if datetime.datetime.strptime(h["time"], "%Y-%m-%d %H:%M") >= start_time
    ]
    if not filtered:
        return {"labels": [], "salinity": [], "temperature": [], "ph": [], "water": [], "stats": {}}

    step = max(1, len(filtered) // 100)
    sampled = filtered[::step]

    sal = [h.get("salinity", 0) for h in sampled]
    temp = [h.get("temperature", 0) for h in sampled]
    ph = [h.get("ph", 7) for h in sampled]
    water = [h.get("water_level", 0) for h in sampled]

    def calc_stats(data):
        if not data:
            return {"avg": 0, "min": 0, "max": 0}
        return {"avg": round(sum(data) / len(data), 1), "min": round(min(data), 1), "max": round(max(data), 1)}

    return {
        "labels": [h["time"] for h in sampled],
        "salinity": sal,
        "temperature": temp,
        "ph": ph,
        "water": water,
        "stats": {
            "salinity": calc_stats(sal),
            "temperature": calc_stats(temp),
            "ph": calc_stats(ph),
            "water": calc_stats(water),
        },
    }

# =========================
# ===== WEATHER API =======
# =========================

LOCATIONS = {
    "ST-01": {"lat": 9.60, "lon": 105.97, "name": "Sóc Trăng"},
    "ST-02": {"lat": 9.29, "lon": 105.72, "name": "Bạc Liêu"},
    "ST-03": {"lat": 10.01, "lon": 105.08, "name": "Kiên Giang"},
    "ST-04": {"lat": 9.17, "lon": 105.15, "name": "Cà Mau"},
}

@app.get("/api/weather-schedule")
async def get_weather(device_id: str = "ST-01"):
    loc = LOCATIONS.get(device_id, LOCATIONS["ST-01"])
    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={loc['lat']}&longitude={loc['lon']}"
            f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&past_days=7&forecast_days=7"
            f"&current_weather=true&timezone=Asia%2FBangkok"
        )
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
                "chart_rain": daily.get("precipitation_sum", []),
            },
            "tide": {
                "level": f"{tide_levels[-1]}m" if tide_levels else "0m",
                "advice": "Triều đang lên",
                "color": "green",
                "chart_data": tide_levels,
            },
        }
    except Exception:
        return {"status": "error"}

@app.get("/api/weather-prediction")
async def get_weather_prediction(device_id: str = "ST-01"):
    weather_data = await get_weather(device_id)
    if weather_data.get("status") != "ok":
        return {"prediction": "Không thể lấy dữ liệu thời tiết."}

    if model is None:
        return {"prediction": "AI chưa sẵn sàng (thiếu cấu hình API Key hoặc lỗi khởi tạo)."}

    try:
        station_info = STATION_CONFIG.get(device_id, {"crop": "rice"})
        crop_type = "Lúa" if station_info["crop"] == "rice" else "Tôm"

        w = weather_data["weather"]
        max_temp = max(w["chart_temps_max"]) if w.get("chart_temps_max") else w.get("temp", 30)
        total_rain = sum(w["chart_rain"]) if w.get("chart_rain") else 0

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
""".strip()

        res = model.generate_content(prompt)
        return {"prediction": (res.text or "").strip()}
    except Exception as e:
        print(f"AI Error: {e}")
        return {"prediction": "Hệ thống AI đang bận phân tích, vui lòng thử lại sau."}

# =========================
# ===== LOGIN API (bcrypt)
# =========================

class RegisterData(BaseModel):
    username: str  # phone number
    password: str
    full_name: str
    farm_location: str
    station_id: str = "ST-01"

@app.post("/api/register")
async def register(data: RegisterData):
    users = load_users()
    if _maybe_migrate_passwords(users):
        save_users(users)

    if any(u.get("username") == data.username for u in users):
        raise HTTPException(status_code=409, detail={"status": "error", "msg": "Số điện thoại đã được đăng ký."})

    new_user = {
        "username": data.username,
        "password": _hash_password(data.password),
        "name": f"{data.full_name} ({data.farm_location})",
        "role": "user",
        "station_id": data.station_id,
    }
    users.append(new_user)
    save_users(users)
    return {"status": "ok", "msg": "Đăng ký thành công!"}

class LoginData(BaseModel):
    username: str
    password: str

@app.post("/api/login")
async def login(data: LoginData):
    users = load_users()
    changed = _maybe_migrate_passwords(users)
    if changed:
        save_users(users)

    for u in users:
        if u.get("username") == data.username:
            if _verify_password(data.password, u.get("password", "")):
                return {
                    "status": "ok",
                    "msg": u.get("name", ""),
                    "station_id": u.get("station_id", "ST-01"),
                    "role": u.get("role", "user"),
                }
            return {"status": "error", "msg": "Sai mật khẩu"}
    return {"status": "error", "msg": "Số điện thoại không tồn tại"}

# =========================
# ===== AI IMAGE API ======
# =========================

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not GOOGLE_API_KEY:
        return {"status": "error", "msg": "Thiếu API Key", "solution": ""}

    if model is None:
        return {"status": "unknown", "msg": "AI chưa sẵn sàng", "solution": "Kiểm tra cấu hình API Key."}

    try:
        img = Image.open(io.BytesIO(await file.read()))

        prompt = """
Vai trò: Bạn là Chuyên gia Bác sĩ Nông nghiệp (AI Plant Pathologist) với 20 năm kinh nghiệm về Lúa và Tôm tại Đồng Bằng Sông Cửu Long.

Nhiệm vụ: Hãy quan sát kỹ hình ảnh được cung cấp và thực hiện:
1. Xác định đối tượng: Lúa, Tôm, hay môi trường nước? (Nếu không phải ảnh nông nghiệp, báo lỗi).
2. Chẩn đoán: Tìm dấu hiệu bệnh (đốm lá, rầy nâu, hoại tử gan tụy, đốm trắng...).
3. Đề xuất: Phác đồ điều trị hoặc phòng ngừa.

Yêu cầu đầu ra: Chỉ trả về 1 chuỗi JSON duy nhất (không Markdown) theo định dạng:
{
  "status": "healthy" | "diseased" | "pest" | "unknown",
  "msg": "Tên bệnh/Vấn đề ngắn gọn",
  "solution": "Lời khuyên kỹ thuật chi tiết (tối đa 3 câu)"
}
""".strip()

        res = model.generate_content([prompt, img])
        text = (res.text or "").replace("```json", "").replace("```", "").strip()
        return json.loads(text)

    except Exception as e:
        print(f"AI Image Error: {e}")
        return {
            "status": "unknown",
            "msg": "Không thể phân tích ảnh này",
            "solution": "Vui lòng chụp lại ảnh rõ nét hơn hoặc kiểm tra kết nối mạng.",
        }

# =========================
# ===== ADMIN API ========
# =========================

@app.get("/api/admin/users")
async def get_users():
    users = load_users()
    safe = []
    for u in users:
        u2 = dict(u)
        u2.pop("password", None)
        safe.append(u2)
    return safe

@app.get("/api/admin/sensor-data")
async def get_sensor_data():
    return db

class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str
    station_id: str

@app.post("/api/admin/add-user")
async def add_user(user: UserCreate):
    users = load_users()
    if any(u.get("username") == user.username for u in users):
        raise HTTPException(status_code=409, detail={"status": "error", "msg": "Username đã tồn tại"})

    users.append({
        "username": user.username,
        "password": _hash_password(user.password),
        "name": user.name,
        "role": user.role,
        "station_id": user.station_id,
    })
    save_users(users)
    return {"status": "ok"}

@app.delete("/api/admin/delete-user/{username}")
async def delete_user(username: str):
    users = load_users()
    users = [u for u in users if u.get("username") != username]
    save_users(users)
    return {"status": "ok"}

@app.delete("/api/admin/clear-history/{station_id}")
async def clear_history(station_id: str):
    if station_id in db["stations"]:
        db["stations"][station_id]["history"] = []
        save_data(db)
    return {"status": "ok"}

@app.post("/api/admin/add-station")
async def add_station(data: dict):
    sid = data.get("station_id")
    if sid and sid not in db["stations"]:
        db["stations"][sid] = create_station_template()
        save_data(db)
    return {"status": "ok"}
