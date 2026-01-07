from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles # <-- Thư viện mới để quản lý file tĩnh
from fastapi.templating import Jinja2Templates # <-- Thư viện mới để quản lý HTML
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import datetime, random, requests, asyncio, math

app = FastAPI()

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# === 1. CẤU HÌNH ĐƯỜNG DẪN MỚI (QUAN TRỌNG) ===

# Báo cho Server biết: "Mọi file trong folder /static hãy cứ để người dùng truy cập thoải mái"
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Báo cho Server biết: "Muốn tìm file HTML thì vào folder /templates"
templates = Jinja2Templates(directory="app/templates")


# === 2. CÁC API TRẢ VỀ GIAO DIỆN ===

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    # Thay vì FileResponse, giờ dùng TemplateResponse
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/admin", response_class=HTMLResponse)
async def read_admin(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})


# === 3. CÁC API LOGIC (GIỮ NGUYÊN KHÔNG ĐỔI) ===

current_status = {"salinity": 0, "temperature": 0, "ph": 0, "is_danger": False, "alert": ""}

@app.get("/api/get-status")
async def get_status():
    global current_status
    return current_status

class SensorData(BaseModel):
    station_id: str
    salinity: float
    temperature: float
    ph: float

@app.post("/api/update-sensor")
async def update_sensor(data: SensorData):
    global current_status
    is_danger = False
    alert_msg = "Ổn định"
    if data.salinity > 4.0:
        is_danger = True
        alert_msg = f"Độ mặn cao ({data.salinity}‰) - Cần đóng cống!"
    
    current_status = {
        "salinity": round(data.salinity, 1),
        "temperature": round(data.temperature, 1),
        "ph": round(data.ph, 1),
        "is_danger": is_danger,
        "alert": alert_msg
    }
    return {"status": "ok"}

# --- 3. API THỜI TIẾT & ĐỊA ĐIỂM (OPEN-METEO) ---
LOCATIONS = {
    "ST-01": {"name": "Sóc Trăng", "lat": 9.60, "lon": 105.97},
    "BL-02": {"name": "Bạc Liêu", "lat": 9.29, "lon": 105.72}, 
}

# 1. Hàm tìm tọa độ từ tên địa điểm (Dùng OpenStreetMap)
def get_coordinates(address):
    try:
        # User-Agent là bắt buộc để không bị chặn
        headers = {'User-Agent': 'MekongSightAI/1.0'}
        url = f"https://nominatim.openstreetmap.org/search?q={address}&format=json&limit=1"
        
        # Gửi yêu cầu lên mạng
        response = requests.get(url, headers=headers, timeout=5)
        data = response.json()
        
        if data:
            return {
                "lat": float(data[0]['lat']), 
                "lon": float(data[0]['lon']),
                "display_name": data[0]['display_name']
            }
        return None
    except:
        print("Lỗi kết nối định vị!")
        return None

# 2. Hàm lấy thời tiết từ tọa độ (Dùng Open-Meteo)
def get_real_weather(lat, lon):
    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&timezone=Asia%2FBangkok"
        
        # Gửi yêu cầu lên mạng
        response = requests.get(url, timeout=5)
        data = response.json()
        
        # Lấy dữ liệu
        temp = data['current_weather']['temperature']
        wcode = data['current_weather']['weathercode']
        
        # Dịch mã thời tiết
        desc = "Trời đẹp"
        if wcode in [1, 2, 3]: desc = "Có mây"
        elif wcode >= 51: desc = "Có mưa"
        
        return {"temp": temp, "desc": desc}
    except:
        return {"temp": "--", "desc": "Lỗi mạng"}

def get_tide_forecast():
    today = datetime.date.today()
    cycle = math.sin(today.day * 0.5)
    return {
        "status": "TRIỀU CƯỜNG" if cycle > 0.5 else "BÌNH THƯỜNG",
        "level": "2.8m" if cycle > 0.5 else "1.2m",
        "date": today.strftime("%d/%m/%Y"),
        "advice": "Gia cố bờ bao" if cycle > 0.5 else "Có thể lấy nước"
    }

@app.get("/api/weather-schedule")
async def get_weather_schedule(device_id: str = "ST-01"):
    # Mặc định lấy theo mã trạm nếu không tìm thấy
    loc = LOCATIONS.get(device_id, LOCATIONS["ST-01"])
    weather = get_real_weather(loc['lat'], loc['lon'])
    tide = get_tide_forecast()
    return {"location_name": loc['name'], "weather": weather, "tide": tide}

@app.get("/api/location-data")
async def get_location_data(address: str):
    coords = get_coordinates(address)
    if not coords: 
        coords = {"lat": 10.0, "lon": 105.0, "name": "Không tìm thấy"}
    
    weather = get_real_weather(coords['lat'], coords['lon'])
    tide = get_tide_forecast()
    return {"location": coords['name'], "weather": weather, "tide": tide}

# --- 4. API AI ---
@app.post("/api/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    await asyncio.sleep(1)
    return {"status": "healthy", "msg": "Lúa phát triển tốt", "solution": "Tiếp tục theo dõi"}