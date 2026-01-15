let updateInterval;
let weatherInterval;
let salinityChartInstance = null;
let tempChartInstance = null;
let tideChartInstance = null;
let currentRange = "24h";
let userStationId = "ST-01";

// ... (Giữ nguyên phần Login và Init System) ...
async function handleLogin() {
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (data.status === 'ok') {
            userStationId = data.station_id;
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            document.getElementById('display-name').innerText = "Xin chào, " + data.msg;
            initSystem();
        } else {
            document.getElementById('login-error').innerText = data.msg;
            document.getElementById('login-error').style.display = 'block';
        }
    } catch (e) { alert("Lỗi kết nối server!"); }
}

function initSystem() {
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('vi-VN');
    fetchData();
    fetchWeather(); // Gọi ngay để lấy data 30 ngày
    fetchHistory('24h');
    updateInterval = setInterval(fetchData, 2000);
}

// ... (Giữ nguyên fetchData, updateGauge, changeRange, fetchHistory) ...
async function fetchData() {
    try {
        const res = await fetch(`/api/sensor?device_id=${userStationId}&t=` + new Date().getTime());
        const data = await res.json();
        document.getElementById("val-sal").innerText = data.salinity.toFixed(1);
        document.getElementById("val-temp").innerText = data.temperature.toFixed(1) + " °C";
        document.getElementById("val-ph").innerText = data.ph.toFixed(1);
        document.getElementById("val-water").innerText = data.water_level.toFixed(0) + " cm";
        updateGauge(data.salinity);
        const ai = evaluateStatus(data.salinity, data.temperature, data.ph, data.water_level);
        updateAICard(ai);
        if (currentRange === '24h' && document.getElementById('page-monitor').classList.contains('active')) {
            fetchHistory('24h');
        }
    } catch (e) { }
}

function changeRange(range) {
    currentRange = range;
    document.querySelectorAll(".range-btn").forEach(btn => btn.classList.remove("active"));
    const btns = document.querySelectorAll(".range-btn");
    if (range === '24h') btns[0].classList.add("active");
    if (range === '7d') btns[1].classList.add("active");
    if (range === '30d') btns[2].classList.add("active");
    fetchHistory(range);
}

async function fetchHistory(range) {
    try {
        const res = await fetch(`/api/sensor-history?device_id=${userStationId}&range=${range}&t=` + new Date().getTime());
        const data = await res.json();
        renderSalinityChart(data, range);
    } catch (e) { }
}

function updateGauge(value) {
    if (value > 20) value = 20; if (value < 0) value = 0;
    const angle = (value / 20) * 180 - 90;
    document.getElementById('gauge-needle').style.transform = `rotate(${angle}deg)`;
}

// === [QUAN TRỌNG] HÀM THỜI TIẾT MỚI ===
async function fetchWeather() {
    try {
        const res = await fetch(`/api/weather-schedule?device_id=${userStationId}`);
        const data = await res.json();

        if (data.status === 'ok') {
            // Cập nhật số liệu
            document.getElementById('weather-temp').innerText = data.weather.temp + "°C";
            document.getElementById('weather-desc').innerText = data.weather.desc;
            document.getElementById('tide-level').innerText = data.tide.level;
            document.getElementById('tide-advice').innerText = data.tide.advice;
            document.getElementById('tide-advice').style.color = data.tide.color === 'red' ? '#ef4444' : '#10b981';

            // Vẽ biểu đồ với dữ liệu thực 37 ngày
            // Chỉ lấy Ngày-Tháng (MM-DD) để hiển thị cho gọn
            const dates = data.weather.chart_dates.map(d => d.slice(5));
            const temps = data.weather.chart_temps;
            const tides = data.tide.chart_data;

            renderWeatherCharts(dates, temps, tides);
        }
    } catch (e) { console.log("Lỗi Weather:", e); }
}

function renderWeatherCharts(dates, temps, tides) {
    // Biểu đồ Nhiệt độ (Line Chart)
    const ctxTemp = document.getElementById('tempChart');
    if (ctxTemp) {
        if (tempChartInstance) tempChartInstance.destroy();
        tempChartInstance = new Chart(ctxTemp, {
            type: 'line',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Nhiệt độ (°C)',
                    data: temps,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.1)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 1 // Điểm nhỏ vì dữ liệu nhiều (37 ngày)
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    // Biểu đồ Triều (Bar Chart)
    const ctxTide = document.getElementById('tideChart');
    if (ctxTide) {
        if (tideChartInstance) tideChartInstance.destroy();
        tideChartInstance = new Chart(ctxTide, {
            type: 'bar',
            data: {
                labels: dates,
                datasets: [{
                    label: 'Mực triều (m)',
                    data: tides,
                    backgroundColor: '#3b82f6',
                    borderRadius: 2
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// ... (Các hàm khác giữ nguyên: renderSalinityChart, evaluateStatus, uploadImage...) ...
function renderSalinityChart(data, range) {
    const ctx = document.getElementById("salinityChart").getContext('2d');
    if (salinityChartInstance) salinityChartInstance.destroy();
    salinityChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: data.labels,
            datasets: [{
                label: "Độ mặn (‰)", data: data.salinity,
                borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.15)",
                tension: 0.2, fill: true, pointRadius: range === '24h' ? 3 : 1
            }, {
                label: "Ngưỡng", data: Array(data.labels.length).fill(data.threshold),
                borderColor: "#ef4444", borderDash: [5, 5], pointRadius: 0, borderWidth: 1
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
}
function evaluateStatus(sal, temp, ph, water) {
    let risk = 0, reasons = [], advice = [];
    if (sal > 4) { risk++; reasons.push("Độ mặn cao"); advice.push("Ngưng lấy nước"); }
    let status = "TỐT", color = "green";
    if (risk >= 1) { status = "CẢNH BÁO"; color = "orange"; }
    updateAICard({ status, color, reasons, advice });
    return { status, color };
}
function updateAICard(ai) {
    const card = document.querySelector(".ai-summary-card");
    if (card) {
        card.className = "card ai-summary-card " + ai.color;
        document.getElementById("ai-status-text").innerText = "Tình trạng: " + ai.status;
    }
}
async function uploadImage() {
    const file = document.getElementById('camera-input').files[0];
    if (!file) return;
    document.getElementById('preview-img').style.display = 'block';
    document.getElementById('preview-img').src = URL.createObjectURL(file);
    document.getElementById('ai-status').innerText = "Đang phân tích...";
    const formData = new FormData(); formData.append('file', file);
    try {
        const res = await fetch('/api/analyze-image', { method: 'POST', body: formData });
        const result = await res.json();
        document.getElementById('ai-status').innerText = result.msg;
        document.getElementById('ai-solution').innerText = result.solution;
    } catch (e) { document.getElementById('ai-status').innerText = "Lỗi kết nối AI"; }
}
function switchPage(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');
    if (pageId === 'weather') fetchWeather();
}
function handleLogout() { location.reload(); }
function clearEventLog() { document.getElementById("event-log").innerHTML = ""; }
function detectAndLogEvents() { }