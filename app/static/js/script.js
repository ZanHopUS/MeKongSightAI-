let updateInterval;
let weatherInterval;

// === 1. HỆ THỐNG ĐĂNG NHẬP ===
async function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorBox = document.getElementById('login-error');

    if (!user || !pass) {
        showLoginError("Vui lòng nhập đầy đủ thông tin!");
        return;
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();

        if (data.status === 'ok') {
            // Đăng nhập thành công
            document.getElementById('login-container').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('login-container').style.display = 'none';
                document.getElementById('main-app').style.display = 'flex';
            }, 500);

            // Cập nhật thông tin User
            document.getElementById('display-name').innerText = "Xin chào, " + (data.username || user);

            // Khởi động hệ thống
            initSystem();
        } else {
            showLoginError(data.msg);
        }
    } catch (e) {
        showLoginError("Lỗi kết nối Server! Vui lòng kiểm tra lại.");
        console.error(e);
    }
}

function showLoginError(msg) {
    const box = document.getElementById('login-error');
    box.style.display = 'flex';
    box.querySelector('span').innerText = msg;
    box.classList.add('shake-anim');
    setTimeout(() => box.classList.remove('shake-anim'), 500);
}

function handleLogout() {
    if (confirm("Bạn có chắc muốn đăng xuất?")) {
        location.reload(); // Tải lại trang để về màn hình login
    }
}

// === 2. ĐIỀU HƯỚNG (NAVIGATION) ===
function switchPage(pageId) {
    // Ẩn tất cả trang
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    // Hiện trang đích
    document.getElementById('page-' + pageId).classList.add('active');

    // Cập nhật Menu (PC & Mobile)
    document.querySelectorAll('.nav-link, .mobile-item').forEach(el => el.classList.remove('active'));

    if (document.getElementById('nav-' + pageId)) document.getElementById('nav-' + pageId).classList.add('active');
    if (document.getElementById('mob-' + pageId)) document.getElementById('mob-' + pageId).classList.add('active');
}

// === 3. LOGIC HỆ THỐNG ===
function initSystem() {
    // Cập nhật ngày
    const now = new Date();
    document.getElementById('current-date').innerText = now.toLocaleDateString('vi-VN');

    // Gọi dữ liệu lần đầu
    fetchSensorData();
    fetchWeather();

    // Thiết lập vòng lặp
    updateInterval = setInterval(fetchSensorData, 2000); // 2s/lần
    weatherInterval = setInterval(fetchWeather, 60000); // 1 phút/lần
}

async function fetchSensorData() {
    try {
        const res = await fetch('/api/get-status');
        const data = await res.json();

        // Cập nhật số liệu
        document.getElementById('val-sal').innerText = data.salinity.toFixed(1);
        document.getElementById('val-temp').innerText = data.temperature + " °C";
        document.getElementById('val-ph').innerText = data.ph;
        document.getElementById('val-water').innerText = data.water_level + " cm";

        // Logic quay kim đồng hồ (0 - 20 phần nghìn)
        let sal = data.salinity;
        if (sal > 20) sal = 20; if (sal < 0) sal = 0;
        // Map 0-20 to -90deg to 90deg
        const angle = (sal / 20) * 180 - 90;
        document.getElementById('gauge-needle').style.transform = `rotate(${angle}deg)`;

        // Xử lý cảnh báo
        const alertBox = document.getElementById('alert-box');
        if (data.is_danger) {
            alertBox.style.display = 'flex';
            document.getElementById('alert-msg').innerText = data.alert;
        } else {
            alertBox.style.display = 'none';
        }
    } catch (e) {
        console.log("Waiting for sensor...");
    }
}

async function fetchWeather() {
    try {
        const res = await fetch('/api/weather-schedule?device_id=ST-01');
        const data = await res.json();

        document.getElementById('weather-temp').innerText = data.weather.temp + "°C";
        document.getElementById('weather-desc').innerText = data.weather.desc;

        document.getElementById('tide-level').innerText = data.tide.level;
        document.getElementById('tide-advice').innerText = data.tide.advice;

        // Đổi màu lời khuyên
        const adviceEl = document.getElementById('tide-advice');
        if (data.tide.color === 'red') adviceEl.style.color = '#ef4444';
        else adviceEl.style.color = '#10b981';

    } catch (e) { console.log("Weather error"); }
}

// === 4. TRỢ LÝ AI ===
async function uploadImage() {
    const file = document.getElementById('camera-input').files[0];
    if (!file) return;

    // Hiển thị giao diện chờ
    const resultCard = document.getElementById('ai-result');
    resultCard.style.display = 'block';
    document.getElementById('preview-img').src = URL.createObjectURL(file);

    const statusText = document.getElementById('ai-status');
    const solutionText = document.getElementById('ai-solution');

    statusText.innerText = "Đang phân tích...";
    statusText.style.color = "#f59e0b"; // Vàng
    solutionText.innerText = "AI đang suy nghĩ...";

    // Scroll xuống kết quả
    resultCard.scrollIntoView({ behavior: 'smooth' });

    // Gửi ảnh
    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch('/api/analyze-image', { method: 'POST', body: formData });
        const result = await res.json();

        statusText.innerText = result.msg;
        solutionText.innerText = result.solution;

        // Đổi màu theo trạng thái
        if (result.status === 'healthy') {
            statusText.style.color = "#10b981"; // Xanh
        } else if (result.status === 'sick') {
            statusText.style.color = "#ef4444"; // Đỏ
        } else {
            statusText.style.color = "#6b7280"; // Xám (Unknown)
        }

    } catch (e) {
        statusText.innerText = "Lỗi kết nối AI";
        statusText.style.color = "#ef4444";
    }
}