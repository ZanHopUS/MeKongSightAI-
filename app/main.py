from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime, requests, json, os, math
import google.generativeai as genai
from PIL import Image
import io

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


# CẤU HÌNH GEMINI AI

GOOGLE_API_KEY = "AIzaSyDMd9LKnu0-JFbvjnIyL3muDYGthuudgW0"
genai.configure(api_key=GOOGLE_API_KEY)

# Sử dụng model Flash cho nhanh và rẻ
model = genai.GenerativeModel('gemini-flash-latest')


# 1. DATABASE & LOGIC CŨ 

DB_FILE = "sensor_data.json"
default_status = {
    "salinity": 0, "temperature": 0, "ph": 0, 
    "water_level": 120, "is_danger": False, "alert": ""
}

def load_data():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, "r") as f: return json.load(f)
        except: pass
    return default_status.copy()

def save_data(data):
    try:
        with open(DB_FILE, "w") as f: json.dump(data, f)
    except: pass

current_status = load_data()

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def read_admin(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})

@app.get("/api/get-status")
async def get_status():
    return current_status

class SensorData(BaseModel):
    station_id: str
    salinity: float
    temperature: float
    ph: float
    water_level: float = 120.0

@app.post("/api/update-sensor")
async def update_sensor(data: SensorData):
    global current_status
    is_danger = False
    alert_msg = "Ổn định"
    if data.salinity > 4.0:
        is_danger = True
        alert_msg = f"Độ mặn cao ({data.salinity}‰)"
    
    current_status = {
        "salinity": round(data.salinity, 1),
        "temperature": round(data.temperature, 1),
        "ph": round(data.ph, 1),
        "water_level": round(data.water_level, 0),
        "is_danger": is_danger,
        "alert": alert_msg
    }
    save_data(current_status)
    return {"status": "ok"}

# 2. API THỜI TIẾT

LOCATIONS = {
    "ST-01": {"name": "Sóc Trăng", "lat": 9.60, "lon": 105.97},
    "BL-02": {"name": "Bạc Liêu", "lat": 9.29, "lon": 105.72}, 
}

def get_real_weather(lat, lon):
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&timezone=Asia%2FBangkok"
        res = requests.get(url, timeout=3).json()
        temp = res['current_weather']['temperature']
        code = res['current_weather']['weathercode']
        desc = "Nắng đẹp"
        if code > 3: desc = "Có mây/Mưa"
        return {"temp": temp, "desc": desc}
    except:
        return {"temp": 30.5, "desc": "Giả lập (Mất mạng)"}

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
    return {"location_name": loc['name'], "weather": weather, "tide": tide}


# 3. TÍCH HỢP GEMINI VISION

@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    try:
        # 1. Đọc ảnh từ client gửi lên
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # 2. Câu lệnh Prompt gửi cho Gemini (Yêu cầu trả về JSON chuẩn)
        prompt = """
        Bạn là chuyên gia nông nghiệp AI. Hãy nhìn vào ảnh cây lúa này và phân tích.
        Hãy trả về kết quả CHỈ LÀ MỘT JSON thuần túy (không markdown) theo định dạng sau:
        {
            "status": "healthy" hoặc "sick",
            "msg": "Tên bệnh hoặc Tình trạng (Ngắn gọn)",
            "solution": "Giải pháp khắc phục cụ thể (Ngắn gọn dưới 20 từ)"
        }
        Nếu không phải ảnh cây cối/lúa, hãy trả về status: "unknown".
        """

        # 3. Gọi Gemini xử lý
        response = model.generate_content([prompt, image])
        
        # 4. Xử lý kết quả trả về (Lọc bỏ Markdown ```json nếu có)
        text_res = response.text.replace("```json", "").replace("```", "").strip()
        result_json = json.loads(text_res)

        return result_json

    except Exception as e:
        print(f"Lỗi AI: {e}")
        # Fallback nếu AI lỗi hoặc hết quota
        return {
            "status": "sick", 
            "msg": "⚠️ Lỗi kết nối AI", 
            "solution": "Vui lòng thử lại sau giây lát."
        }