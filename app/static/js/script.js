// === CẤU HÌNH DỮ LIỆU NÔNG NGHIỆP ===
const FARMING_DATA = {
    'rice': {
        name: "Vụ Lúa",
        varieties: {
            'st25': {
                name: "Lúa ST24/ST25 (Chịu mặn)",
                rules: {
                    salinity: { max: 4.0, msg: "Mặn cao > 4‰. Nguy hiểm cho lúa trổ bông." },
                    ph: { min: 5.5, max: 7.5, msg: "pH đất không ổn định." },
                    water: { min: 5, max: 20, msg: "Cần giữ mực nước 5-20cm." }
                }
            },
            'om5451': {
                name: "Lúa OM5451 (Ngọt)",
                rules: {
                    salinity: { max: 2.0, msg: "NGUY HIỂM! Giống này chịu mặn rất kém (<2‰)." },
                    ph: { min: 6.0, max: 7.0, msg: "Đất chua phèn, cần bón vôi." },
                    water: { min: 5, max: 15, msg: "Mực nước chưa phù hợp." }
                }
            }
        }
    },
    'shrimp': {
        name: "Vụ Tôm",
        varieties: {
            'tom_su': {
                name: "Tôm Sú (Quảng canh)",
                rules: {
                    salinity: { min: 10, max: 30, msg: "Độ mặn cần 10-30‰ để tôm lột vỏ tốt." },
                    ph: { min: 7.5, max: 8.5, msg: "pH biến động, tôm dễ sốc." },
                    water: { min: 80, max: 200, msg: "Nước cạn (<80cm), nhiệt độ nước sẽ tăng cao." }
                }
            },
            'tom_the': {
                name: "Tôm Thẻ (Công nghiệp)",
                rules: {
                    salinity: { min: 15, max: 35, msg: "Độ mặn thấp, cần bổ sung khoáng." },
                    ph: { min: 7.2, max: 8.3, msg: "pH cao, cảnh báo khí độc NH3." },
                    water: { min: 100, max: 200, msg: "Mực nước cần sâu >1m." }
                }
            }
        }
    }
};

let currentRules = null;
let userStationId = "ST-01";
let salinityChartInstance = null;
let tempChartInstance = null;
let tideChartInstance = null;
let currentRange = "24h";

// ===== KHỞI CHẠY =====
document.addEventListener("DOMContentLoaded", () => {
    updateVarieties();
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('vi-VN');
});

// ===== LOGIN =====
async function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();

        if (data.status === 'ok') {
            userStationId = data.station_id;
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            document.getElementById('display-name').innerText = data.msg;
            initSystem();
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (e) {
        alert("Lỗi kết nối Server!");
    }
}

function initSystem() {
    fetchData();
    fetchWeather();
    fetchHistory('24h');
    setInterval(fetchData, 2000);
}

// ===== LOGIC CHỌN GIỐNG =====
function updateVarieties() {
    const type = document.getElementById('crop-type').value;
    const varietySelect = document.getElementById('crop-variety');
    varietySelect.innerHTML = "";

    const list = FARMING_DATA[type].varieties;
    for (const key in list) {
        let opt = document.createElement('option');
        opt.value = key;
        opt.innerText = list[key].name;
        varietySelect.appendChild(opt);
    }
    updateThresholds();
}

function updateThresholds() {
    const type = document.getElementById('crop-type').value;
    const variety = document.getElementById('crop-variety').value;
    currentRules = FARMING_DATA[type].varieties[variety];
    document.getElementById('current-standard').innerText = currentRules.name;
    fetchData();
}

// ===== LẤY DỮ LIỆU & PHÂN TÍCH =====
async function fetchData() {
    try {
        const res = await fetch(`/api/sensor?device_id=${userStationId}`);
        const data = await res.json();

        // Update giá trị hiển thị
        document.getElementById('val-sal').innerText = data.salinity.toFixed(1);
        document.getElementById('val-temp').innerText = data.temperature + "°C";
        document.getElementById('val-ph').innerText = data.ph;
        document.getElementById('val-water').innerText = data.water_level + " cm";

        // Update Gauge needle
        let deg = (data.salinity / 20) * 180 - 90;
        document.getElementById('gauge-needle').style.transform = `rotate(${deg}deg)`;

        // Phân tích môi trường
        analyzeEnvironment(data.salinity, data.ph, data.water_level);

    } catch (e) {
        console.error("Lỗi fetch data:", e);
    }
}

function analyzeEnvironment(sal, ph, water) {
    if (!currentRules) return;

    const r = currentRules.rules;
    let adviceHtml = "";
    let statusText = "MÔI TRƯỜNG TỐT";
    let badgeClass = "st-bg-green";
    let icon = "fa-check-circle";

    // 1. Phân tích độ mặn
    if (r.salinity.max && sal > r.salinity.max) {
        statusText = "NGUY HIỂM";
        badgeClass = "st-bg-red";
        icon = "fa-exclamation-triangle";
        adviceHtml += `<li><i class="fas fa-tint" style="color:#ef4444"></i> <b>Độ mặn:</b> ${r.salinity.msg}</li>`;
    } else if (r.salinity.min && sal < r.salinity.min) {
        if (statusText !== "NGUY HIỂM") {
            statusText = "CẢNH BÁO";
            badgeClass = "st-bg-yellow";
            icon = "fa-exclamation-circle";
        }
        adviceHtml += `<li><i class="fas fa-tint" style="color:#f59e0b"></i> <b>Độ mặn:</b> ${r.salinity.msg}</li>`;
    }

    // 2. Phân tích pH
    if (ph < r.ph.min || ph > r.ph.max) {
        if (statusText !== "NGUY HIỂM") {
            statusText = "CẢNH BÁO";
            badgeClass = "st-bg-yellow";
            icon = "fa-exclamation-circle";
        }
        adviceHtml += `<li><i class="fas fa-flask" style="color:#f59e0b"></i> <b>Độ pH:</b> ${r.ph.msg}</li>`;
    }

    // 3. Phân tích mực nước
    if (water < r.water.min) {
        statusText = "NGUY HIỂM";
        badgeClass = "st-bg-red";
        icon = "fa-exclamation-triangle";
        adviceHtml += `<li><i class="fas fa-arrow-down" style="color:#ef4444"></i> <b>Mực nước:</b> ${r.water.msg}</li>`;
    }

    // Nếu không có vấn đề
    if (adviceHtml === "") {
        adviceHtml = `<li><i class="fas fa-check-circle" style="color:#10b981"></i> Các chỉ số đều nằm trong ngưỡng an toàn. Môi trường phù hợp cho sự phát triển.</li>`;
    }

    // Cập nhật giao diện
    const badge = document.getElementById('status-badge');
    badge.className = `status-badge-lg ${badgeClass}`;
    badge.innerHTML = `<i class="fas ${icon}"></i> <span>${statusText}</span>`;

    document.getElementById('advice-list').innerHTML = adviceHtml;
}

// ===== BIỂU ĐỒ =====
function renderSalinityChart(data, range) {
    const ctx = document.getElementById("salinityChart").getContext('2d');

    // Tạo gradient
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    if (salinityChartInstance) salinityChartInstance.destroy();

    salinityChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.labels,
            datasets: [{
                label: "Độ mặn (‰)",
                data: data.salinity,
                borderColor: "#10b981",
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#10b981",
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 12,
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e5e7eb', borderDash: [5, 5] },
                    ticks: { font: { size: 12, weight: '600' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

function renderTempChart(dates, temps) {
    const ctx = document.getElementById("tempChart").getContext('2d');

    if (tempChartInstance) tempChartInstance.destroy();

    tempChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: dates,
            datasets: [{
                label: "Nhiệt độ tối đa (°C)",
                data: temps,
                borderColor: "#ef4444",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                borderWidth: 3,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#ef4444",
                pointRadius: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: false },
                x: { ticks: { maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

function renderTideChart(dates, levels) {
    const ctx = document.getElementById("tideChart").getContext('2d');

    if (tideChartInstance) tideChartInstance.destroy();

    tideChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: dates,
            datasets: [{
                label: "Mực nước triều (m)",
                data: levels,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderWidth: 3,
                pointBackgroundColor: "#ffffff",
                pointBorderColor: "#3b82f6",
                pointRadius: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { beginAtZero: true },
                x: { ticks: { maxRotation: 45, minRotation: 45 } }
            }
        }
    });
}

// ===== LỊCH SỬ DỮ LIỆU =====
function changeRange(range) {
    currentRange = range;
    document.querySelectorAll(".chart-opts button").forEach(btn => btn.classList.remove("active"));
    event.target.classList.add("active");
    fetchHistory(range);
}

async function fetchHistory(range) {
    try {
        const res = await fetch(`/api/sensor-history?device_id=${userStationId}&range=${range}`);
        const data = await res.json();
        renderSalinityChart(data, range);
    } catch (e) {
        console.error("Lỗi fetch history:", e);
    }
}

// ===== THỜI TIẾT =====
async function fetchWeather() {
    try {
        const res = await fetch(`/api/weather-schedule?device_id=${userStationId}`);
        const data = await res.json();

        if (data.status === 'ok') {
            // Cập nhật thông tin hiện tại
            document.getElementById('weather-temp').innerText = data.weather.temp + "°C";
            document.getElementById('weather-desc').innerText = data.weather.desc;
            document.getElementById('tide-level').innerText = data.tide.level;
            document.getElementById('tide-advice').innerText = data.tide.advice;

            // Render biểu đồ nhiệt độ (37 ngày)
            if (data.weather.chart_dates && data.weather.chart_temps) {
                renderTempChart(data.weather.chart_dates, data.weather.chart_temps);
            }

            // Render biểu đồ thủy triều (37 ngày)
            if (data.tide.chart_data && data.weather.chart_dates) {
                renderTideChart(data.weather.chart_dates, data.tide.chart_data);
            }
        }
    } catch (e) {
        console.error("Lỗi fetch weather:", e);
    }
}

// ===== BÁC SĨ AI =====
async function uploadImage() {
    const file = document.getElementById('camera-input').files[0];
    if (!file) return;

    // Hiển thị preview
    document.getElementById('ai-result').style.display = 'block';
    document.getElementById('preview-img').src = URL.createObjectURL(file);
    document.getElementById('ai-status').innerText = "Đang kết nối bác sĩ AI...";
    document.getElementById('ai-solution').innerText = "Vui lòng chờ...";

    const formData = new FormData();
    formData.append('file', file);

    // Gửi thêm context giống loài
    const varietyName = currentRules ? currentRules.name : "Nông sản";
    formData.append('context', varietyName);

    try {
        const res = await fetch('/api/analyze-image', {
            method: 'POST',
            body: formData
        });
        const result = await res.json();

        document.getElementById('ai-status').innerText = result.msg || "Đã phân tích xong";
        document.getElementById('ai-solution').innerText = result.solution || "Không có khuyến nghị";
    } catch (e) {
        document.getElementById('ai-status').innerText = "Lỗi kết nối AI!";
        document.getElementById('ai-solution').innerText = "Vui lòng thử lại sau.";
    }
}

// ===== ĐIỀU HƯỚNG =====
function switchPage(page) {
    // Ẩn tất cả các trang
    document.querySelectorAll('.page-section').forEach(e => e.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');

    // Cập nhật sidebar
    document.querySelectorAll('.nav-link').forEach(e => e.classList.remove('active'));
    const navLink = document.getElementById('nav-' + page);
    if (navLink) navLink.classList.add('active');

    // Cập nhật mobile nav
    document.querySelectorAll('.mobile-item').forEach(e => e.classList.remove('active'));
    const mobItem = document.getElementById('mob-' + page);
    if (mobItem) mobItem.classList.add('active');
}

function handleLogout() {
    if (confirm("Bạn có chắc muốn đăng xuất?")) {
        location.reload();
    }
}