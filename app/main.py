from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime, json, os, requests, math
from datetime import timedelta
import google.generativeai as genai
from PIL import Image
import io

app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# === AI CONFIG ===
GOOGLE_API_KEY = "AIzaSyCJxu0fC4DHbDUSibE0ziVLzwbKSAhqW4Q" 
try:
    genai.configure(api_key=GOOGLE_API_KEY)
    model = genai.GenerativeModel('gemini-flash-latest')
except: pass

# === DATABASE QUẢN LÝ FILE ===
DB_FILE = "sensor_data.json"

def create_station_template():
    return {
        "current": { "salinity": 0, "temperature": 0, "ph": 0, "water_level": 120, "is_danger": False, "alert": "Chờ dữ liệu..." },
        "history": [] 
    }

def load_data():
    default_data = {"stations": {"ST-01": create_station_template(), "ST-02": create_station_template()}}
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f:
                data = json.load(f)
                if "stations" not in data: return default_data
                return data
        except: return default_data
    return default_data

def save_data(data):
    try:
        with open(DB_FILE, "w") as f: json.dump(data, f, indent=4)
    except: pass

db = load_data()

# === API GIAO DIỆN ===
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def read_admin(request: Request):
    if os.path.exists("admin.html"):
        with open("admin.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return "Không tìm thấy file Admin"

# === API SENSOR ===
@app.get("/api/sensor")
async def get_sensor_current(device_id: str = "ST-01"):
    if device_id not in db["stations"]:
        db["stations"][device_id] = create_station_template()
    return db["stations"][device_id]["current"]

class SensorData(BaseModel):
    station_id: str; salinity: float; temperature: float; ph: float; water_level: float

@app.post("/api/update-sensor")
async def update_sensor(data: SensorData):
    global db
    sid = data.station_id
    if sid not in db["stations"]: db["stations"][sid] = create_station_template()

    is_danger, alert_msg = False, "Ổn định"
    if data.salinity > 4.0: is_danger, alert_msg = True, f"Cảnh báo mặn: {data.salinity}‰"
    if data.water_level < 50: is_danger, alert_msg = True, "Cảnh báo cạn nước"

    db["stations"][sid]["current"] = {
        "salinity": round(data.salinity, 1),
        "temperature": round(data.temperature, 1),
        "ph": round(data.ph, 1),
        "water_level": round(data.water_level, 0),
        "is_danger": is_danger, "alert": alert_msg
    }
    
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    record = {"time": timestamp, "salinity": data.salinity, "temperature": data.temperature}
    db["stations"][sid]["history"].append(record)
    
    if len(db["stations"][sid]["history"]) > 5000:
        db["stations"][sid]["history"].pop(0)

    save_data(db)
    return {"status": "ok"}

# === API LỊCH SỬ ===
@app.get("/api/sensor-history")
async def get_history(device_id: str = "ST-01", range: str = "24h"):
    if device_id not in db["stations"]: return {"labels": [], "salinity": [], "threshold": 4.0}
    full_history = db["stations"][device_id]["history"]
    if not full_history: return {"labels": [], "salinity": [], "threshold": 4.0}

    if range == "24h":
        recent = full_history[-24:]
        return {
            "labels": [h["time"].split(" ")[-1] for h in recent],
            "salinity": [h["salinity"] for h in recent],
            "threshold": 4.0
        }

    now = datetime.datetime.now()
    delta = timedelta(days=7) if range == "7d" else timedelta(days=30)
    start_time = now - delta
    
    filtered_labels = []
    filtered_values = []
    step = 4 if range == "30d" else 1 

    for i, record in enumerate(full_history):
        try:
            rec_time = datetime.datetime.strptime(record["time"], "%Y-%m-%d %H:%M")
            if rec_time >= start_time:
                if i % step == 0:
                    filtered_labels.append(record["time"])
                    filtered_values.append(record["salinity"])
        except: continue

    return {"labels": filtered_labels, "salinity": filtered_values, "threshold": 4.0}

# === [QUAN TRỌNG] API THỜI TIẾT 30 NGÀY TỪ INTERNET ===
LOCATIONS = {"ST-01": {"lat": 9.60, "lon": 105.97}, "ST-02": {"lat": 9.29, "lon": 105.72}}

@app.get("/api/weather-schedule")
async def get_weather(device_id: str = "ST-01"):
    loc = LOCATIONS.get(device_id, LOCATIONS["ST-01"])
    try:
        # Gọi API lấy: 30 ngày quá khứ (past_days=30) + 7 ngày dự báo (forecast_days=7)
        url = f"https://api.open-meteo.com/v1/forecast?latitude={loc['lat']}&longitude={loc['lon']}&daily=temperature_2m_max&past_days=30&forecast_days=7&current_weather=true&timezone=Asia%2FBangkok"
        
        res = requests.get(url, timeout=5).json()
        
        # 1. Dữ liệu hiện tại
        current = res.get("current_weather", {})
        temp_now = current.get("temperature", "--")
        code = current.get("weathercode", 0)
        desc = "Nắng đẹp" if code <= 3 else "Có mưa/Mây"
        
        # 2. Dữ liệu biểu đồ (37 ngày)
        daily = res.get("daily", {})
        chart_dates = daily.get("time", []) 
        chart_temps = daily.get("temperature_2m_max", [])
        
        # 3. Tính toán Triều (Giả lập theo ngày để có data vẽ)
        tide_levels = []
        for i in range(len(chart_dates)):
            val = 2.0 + math.sin(i * 0.2) * 1.2 # Tạo hình sóng triều cường
            tide_levels.append(round(abs(val), 1))

        return {
            "status": "ok",
            "weather": {
                "temp": temp_now,
                "desc": desc,
                "chart_dates": chart_dates,   
                "chart_temps": chart_temps    
            },
            "tide": {
                "level": f"{tide_levels[-1]}m", # Lấy ngày cuối
                "advice": "Triều đang lên" if tide_levels[-1] > 2.0 else "Bình thường",
                "color": "red" if tide_levels[-1] > 2.5 else "green",
                "chart_data": tide_levels     
            }
        }
    except Exception as e:
        print("Lỗi Weather:", e)
        return {
            "status": "error",
            "weather": { "temp": 30, "desc": "Offline", "chart_dates": [], "chart_temps": [] },
            "tide": { "level": "--", "advice": "--", "color": "gray", "chart_data": [] }
        }

# === CÁC API KHÁC ===
USER_DB_FILE = "users.json"
class LoginData(BaseModel): username: str; password: str

@app.post("/api/login")
async def login(data: LoginData):
    if os.path.exists(USER_DB_FILE):
        with open(USER_DB_FILE, "r", encoding="utf-8") as f: users = json.load(f)
        for u in users:
            if u['username'] == data.username and u['password'] == data.password:
                return {"status": "ok", "msg": u['name'], "station_id": u.get("station_id", "ST-01")}
    return {"status": "error", "msg": "Sai thông tin"}

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    if not GOOGLE_API_KEY: return {"status": "error", "msg": "Thiếu API Key"}
    try:
        img = Image.open(io.BytesIO(await file.read()))
        res = model.generate_content(["Phân tích bệnh. JSON: {status, msg, solution}", img])
        return json.loads(res.text.replace("```json", "").replace("```", "").strip())
    except: return {"status": "unknown", "msg": "Lỗi AI", "solution": "Thử lại"}