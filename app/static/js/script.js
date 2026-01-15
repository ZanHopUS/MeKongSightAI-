// MEKONG SIGHT AI - ENHANCED FRONTEND

// === CONFIGURATION ===
const FARMING_DATA = {
    'rice': {
        name: "Vụ Lúa",
        varieties: {
            'st25': {
                name: "Lúa ST24/ST25 (Chịu mặn)",
                stages: {
                    'seedling': 'Giai đoạn mạ (1-20 ngày)',
                    'tillering': 'Đẻ nhánh (21-45 ngày)',
                    'panicle': 'Trổ bông (46-75 ngày)',
                    'flowering': 'Ra hoa (76-90 ngày)',
                    'maturity': 'Chín (91-110 ngày)'
                }
            },
            'om5451': {
                name: "Lúa OM5451 (Ngọt)",
                stages: {
                    'seedling': 'Giai đoạn mạ (1-20 ngày)',
                    'tillering': 'Đẻ nhánh (21-40 ngày)',
                    'panicle': 'Trổ bông (41-70 ngày)',
                    'flowering': 'Ra hoa (71-85 ngày)',
                    'maturity': 'Chín (86-105 ngày)'
                }
            }
        }
    },
    'shrimp': {
        name: "Vụ Tôm",
        varieties: {
            'tom_su': {
                name: "Tôm Sú (Quảng canh)",
                stages: {
                    'postlarval': 'Giai đoạn hậu ấu trùng (1-30 ngày)',
                    'juvenile': 'Tôm con (31-60 ngày)',
                    'subadult': 'Tôm giống (61-90 ngày)',
                    'adult': 'Tôm trưởng thành (91-120 ngày)'
                }
            },
            'tom_the': {
                name: "Tôm Thẻ (Công nghiệp)",
                stages: {
                    'postlarval': 'Giai đoạn hậu ấu trùng (1-25 ngày)',
                    'juvenile': 'Tôm con (26-50 ngày)',
                    'subadult': 'Tôm giống (51-75 ngày)',
                    'adult': 'Tôm trưởng thành (76-100 ngày)'
                }
            }
        }
    }
};

// === STATE MANAGEMENT ===
let currentRules = null;
let userStationId = "ST-01";
let userName = "Người dùng";
let userRole = "user";
let currentGrowthStage = null;

// Chart instances
let salinityChartInstance = null;
let tempChartInstance = null;
let phChartInstance = null;
let waterChartInstance = null;
let weatherTempChartInstance = null;
let rainChartInstance = null;
let tideChartInstance = null;

let currentRange = "24h";
let currentParam = "all";

// Update intervals
let dataInterval = null;
let timeInterval = null;

// INITIALIZATION

document.addEventListener("DOMContentLoaded", () => {
    initializeDatetime();
    updateVarieties();
    updateGrowthStages();

    timeInterval = setInterval(updateDatetime, 1000);
});

function initializeDatetime() {
    updateDatetime();
}

function updateDatetime() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const dateElem = document.getElementById('current-date');
    const timeElem = document.getElementById('current-time');

    if (dateElem) dateElem.textContent = dateStr;
    if (timeElem) timeElem.textContent = timeStr;
}

// AUTHENTICATION

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('login-error');

    if (!username || !password) {
        errorElement.style.display = 'block';
        errorElement.textContent = 'Vui lòng nhập đầy đủ thông tin';
        return;
    }

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.status === 'ok') {
            userName = data.msg;
            userStationId = data.station_id || 'ST-01';
            userRole = data.role || 'user';

            // Hide login, show app
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';

            // Update user info
            document.getElementById('display-name').textContent = userName;
            document.getElementById('station-id').textContent = `Trạm: ${userStationId}`;

            // Show admin link if admin
            if (userRole === 'admin') {
                const adminLink = document.createElement('a');
                adminLink.href = '/admin';
                adminLink.target = '_blank';
                adminLink.className = 'nav-link';
                adminLink.innerHTML = '<i class="fas fa-cog"></i><span>Admin Panel</span>';
                document.querySelector('nav').insertBefore(adminLink, document.querySelector('.logout'));
            }

            // Initialize system
            initializeSystem();
        } else {
            errorElement.style.display = 'block';
            errorElement.textContent = data.msg || 'Sai thông tin đăng nhập';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorElement.style.display = 'block';
        errorElement.textContent = 'Lỗi kết nối đến máy chủ';
    }
}

function handleLogout() {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
        if (dataInterval) clearInterval(dataInterval);
        if (timeInterval) clearInterval(timeInterval);
        location.reload();
    }
}

// SYSTEM INITIALIZATION

function initializeSystem() {
    fetchSensorData();
    fetchWeatherData();
    fetchHistory(currentRange, currentParam);
    fetchWeatherAI();

    // Auto-refresh every 3 seconds
    dataInterval = setInterval(() => {
        fetchSensorData();
    }, 3000);

    // Refresh weather every 10 minutes
    setInterval(() => {
        fetchWeatherData();
    }, 600000);
}

// CROP SELECTION

function updateVarieties() {
    const cropType = document.getElementById('crop-type').value;
    const varietySelect = document.getElementById('crop-variety');

    varietySelect.innerHTML = '';

    const varieties = FARMING_DATA[cropType].varieties;

    for (const [key, variety] of Object.entries(varieties)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = variety.name;
        varietySelect.appendChild(option);
    }

    updateGrowthStages();
    updateThresholds();
}

function updateGrowthStages() {
    const cropType = document.getElementById('crop-type').value;
    const varietyKey = document.getElementById('crop-variety').value;
    const stageSelect = document.getElementById('growth-stage');

    if (!stageSelect) return;

    stageSelect.innerHTML = '<option value="">-- Chọn giai đoạn (tùy chọn) --</option>';

    const variety = FARMING_DATA[cropType]?.varieties[varietyKey];
    if (variety && variety.stages) {
        for (const [key, label] of Object.entries(variety.stages)) {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = label;
            stageSelect.appendChild(option);
        }
    }
}

function updateThresholds() {
    const cropType = document.getElementById('crop-type').value;
    const varietyKey = document.getElementById('crop-variety').value;

    currentRules = FARMING_DATA[cropType].varieties[varietyKey];

    const standardElem = document.getElementById('current-standard');
    if (standardElem) {
        standardElem.textContent = currentRules.name;
    }

    fetchSensorData();
}

// SENSOR DATA FETCHING

async function fetchSensorData() {
    try {
        const response = await fetch(`/api/sensor?device_id=${userStationId}`);
        const data = await response.json();

        updateSensorDisplay(data);
        updateGauge(data.salinity);

        // Get analysis from backend
        const cropType = document.getElementById('crop-type').value;
        const varietyKey = document.getElementById('crop-variety').value;
        const stageSelect = document.getElementById('growth-stage');
        const stage = stageSelect ? stageSelect.value : null;

        const analysisUrl = `/api/analyze?device_id=${userStationId}&crop_type=${cropType}&variety=${varietyKey}${stage ? '&growth_stage=' + stage : ''}`;
        const analysisResponse = await fetch(analysisUrl);
        const analysis = await analysisResponse.json();

        updateAnalysisDisplay(analysis);

    } catch (error) {
        console.error('Fetch sensor data error:', error);
    }
}

function updateSensorDisplay(data) {
    const valSal = document.getElementById('val-sal');
    const valTemp = document.getElementById('val-temp');
    const valPh = document.getElementById('val-ph');
    const valWater = document.getElementById('val-water');

    if (valSal) valSal.textContent = data.salinity.toFixed(1);
    if (valTemp) valTemp.textContent = data.temperature.toFixed(1) + '°C';
    if (valPh) valPh.textContent = data.ph.toFixed(1);
    if (valWater) valWater.textContent = data.water_level.toFixed(0) + ' cm';
}

function updateGauge(salinity) {
    const maxSalinity = 20;
    const angle = ((salinity / maxSalinity) * 180) - 90;
    const clampedAngle = Math.max(-90, Math.min(90, angle));

    const needle = document.getElementById('gauge-needle');
    if (needle) {
        needle.style.transform = `rotate(${clampedAngle}deg)`;
    }
}

// ANALYSIS DISPLAY

function updateAnalysisDisplay(analysis) {
    updateStatusBadge(analysis.level, analysis.status);
    updateAdviceList(analysis.advice, analysis.predictions);
    updateDetailedAnalysis(analysis.detailed_analysis);
}

function updateStatusBadge(level, status) {
    const badge = document.getElementById('status-badge');
    if (!badge) return;

    badge.classList.remove('status-safe', 'status-warning', 'status-danger');

    let className = 'status-safe';
    if (level === 'warning') className = 'status-warning';
    if (level === 'danger') className = 'status-danger';

    badge.classList.add(className);
    badge.innerHTML = `
        <span class="status-indicator"></span>
        <span>${status}</span>
    `;
}

function updateAdviceList(advice, predictions) {
    const listElement = document.getElementById('advice-list');
    if (!listElement) return;

    if (!advice || advice.length === 0) {
        listElement.innerHTML = `
            <li class="alert-item alert-info">
                <i class="fas fa-check-circle"></i>
                <div class="alert-content">
                    <strong>Môi trường ổn định</strong>
                    Tất cả các chỉ số đều nằm trong ngưỡng an toàn.
                </div>
            </li>
        `;
        return;
    }

    let html = '';

    // Add advice items
    advice.forEach(item => {
        let alertClass = 'alert-info';
        let icon = 'fa-info-circle';

        if (item.includes('🚨') || item.includes('NGUY HIỂM')) {
            alertClass = 'alert-danger';
            icon = 'fa-exclamation-triangle';
        } else if (item.includes('⚠️') || item.includes('CẢNH BÁO')) {
            alertClass = 'alert-warning';
            icon = 'fa-exclamation-circle';
        } else if (item.includes('✅')) {
            alertClass = 'alert-info';
            icon = 'fa-check-circle';
        } else if (item.includes('💡') || item.includes('📊')) {
            alertClass = 'alert-info';
            icon = 'fa-lightbulb';
        }

        html += `
            <li class="alert-item ${alertClass}">
                <i class="fas ${icon}"></i>
                <div class="alert-content">${item}</div>
            </li>
        `;
    });

    // Add predictions
    if (predictions && predictions.length > 0) {
        predictions.forEach(pred => {
            html += `
                <li class="alert-item alert-info" style="background: #eff6ff; border-left-color: #3b82f6;">
                    <i class="fas fa-crystal-ball"></i>
                    <div class="alert-content">${pred}</div>
                </li>
            `;
        });
    }

    listElement.innerHTML = html;
}

function updateDetailedAnalysis(detailed) {
    if (!detailed) return;

    // Update score if available
    if (detailed.overall_score !== undefined) {
        const scoreElem = document.getElementById('overall-score');
        if (scoreElem) {
            scoreElem.textContent = detailed.overall_score;

            // Update color based on score
            const scoreContainer = scoreElem.parentElement;
            if (scoreContainer) {
                scoreContainer.className = 'score-display';
                if (detailed.overall_score >= 80) {
                    scoreContainer.classList.add('score-good');
                } else if (detailed.overall_score >= 60) {
                    scoreContainer.classList.add('score-warning');
                } else {
                    scoreContainer.classList.add('score-danger');
                }
            }
        }
    }
}

// CHART RENDERING

function changeRange(range) {
    currentRange = range;

    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    fetchHistory(range, currentParam);
}

function changeParam(param) {
    currentParam = param;

    document.querySelectorAll('.param-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    fetchHistory(currentRange, param);
}

async function fetchHistory(range, param) {
    try {
        const response = await fetch(`/api/sensor-history?device_id=${userStationId}&range=${range}`);
        const data = await response.json();

        // Render các biểu đồ
        if (param === 'all' || param === 'salinity') renderChart('salinityChart', data, 'salinity', 'Độ mặn (‰)', '#16a34a');
        if (param === 'all' || param === 'water') renderChart('waterChart', data, 'water', 'Mực nước (cm)', '#3b82f6');

        // === CẬP NHẬT THỐNG KÊ (FIX LỖI) ===
        if (data.stats) {
            updateStatBox('salinity', data.stats.salinity);
            updateStatBox('temperature', data.stats.temperature);
            updateStatBox('ph', data.stats.ph);
            updateStatBox('water', data.stats.water);
        }

    } catch (error) { console.error(error); }
}

// Hàm phụ trợ cập nhật số liệu
function updateStatBox(type, stats) {
    if (!stats) return;
    const avgEl = document.getElementById(`${type}-avg`);
    const minEl = document.getElementById(`${type}-min`);
    const maxEl = document.getElementById(`${type}-max`);

    if (avgEl) avgEl.textContent = stats.avg;
    if (minEl) minEl.textContent = stats.min;
    if (maxEl) maxEl.textContent = stats.max;
}

function renderChart(canvasId, data, dataKey, label, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(1, color + '00');

    // Get existing chart instance
    let chartInstance;
    if (canvasId === 'salinityChart') chartInstance = salinityChartInstance;
    else if (canvasId === 'tempChart') chartInstance = tempChartInstance;
    else if (canvasId === 'phChart') chartInstance = phChartInstance;
    else if (canvasId === 'waterChart') chartInstance = waterChartInstance;

    // Destroy existing
    if (chartInstance) {
        chartInstance.destroy();
    }

    // Create new chart
    const newChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: label,
                data: data[dataKey],
                borderColor: color,
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 2,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: color,
                pointHoverRadius: 5,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { size: 12, weight: 600 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 }
                }
            },
            scales: {
                y: {
                    beginAtZero: dataKey === 'water',
                    grid: {
                        color: '#e5e7eb',
                        drawBorder: false
                    },
                    ticks: {
                        font: { size: 11 }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: { size: 10 },
                        maxRotation: 45,
                        minRotation: 0
                    }
                }
            }
        }
    });

    // Store instance
    if (canvasId === 'salinityChart') salinityChartInstance = newChart;
    else if (canvasId === 'tempChart') tempChartInstance = newChart;
    else if (canvasId === 'phChart') phChartInstance = newChart;
    else if (canvasId === 'waterChart') waterChartInstance = newChart;
}

function updateStatistics(stats) {
    for (const [param, values] of Object.entries(stats)) {
        const avgElem = document.getElementById(`${param}-avg`);
        const minElem = document.getElementById(`${param}-min`);
        const maxElem = document.getElementById(`${param}-max`);

        if (avgElem) avgElem.textContent = values.avg;
        if (minElem) minElem.textContent = values.min;
        if (maxElem) maxElem.textContent = values.max;
    }
}

// WEATHER DATA

async function fetchWeatherData() {
    try {
        const response = await fetch(`/api/weather-schedule?device_id=${userStationId}`);
        const data = await response.json();

        if (data.status === 'ok') {
            updateWeatherDisplay(data);
            renderWeatherCharts(data);
        }

    } catch (error) {
        console.error('Fetch weather error:', error);
    }
}

function updateWeatherDisplay(data) {
    const tempElem = document.getElementById('weather-temp');
    const descElem = document.getElementById('weather-desc');
    const tideLevelElem = document.getElementById('tide-level');
    const tideAdviceElem = document.getElementById('tide-advice');

    if (tempElem) tempElem.textContent = data.weather.temp + '°C';
    if (descElem) descElem.textContent = data.weather.desc;
    if (tideLevelElem) tideLevelElem.textContent = data.tide.level;
    if (tideAdviceElem) tideAdviceElem.textContent = data.tide.advice;
}

function renderWeatherCharts(data) {
    renderWeatherTempChart(data.weather);
    renderRainChart(data.weather);
    renderTideChart(data.tide, data.weather.chart_dates);
}

function renderWeatherTempChart(weather) {
    const canvas = document.getElementById('weatherTempChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (weatherTempChartInstance) {
        weatherTempChartInstance.destroy();
    }

    weatherTempChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: weather.chart_dates,
            datasets: [
                {
                    label: 'Nhiệt độ tối đa (°C)',
                    data: weather.chart_temps_max,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Nhiệt độ tối thiểu (°C)',
                    data: weather.chart_temps_min,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: '#e5e7eb' }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function renderRainChart(weather) {
    const canvas = document.getElementById('rainChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (rainChartInstance) {
        rainChartInstance.destroy();
    }

    rainChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: weather.chart_dates,
            datasets: [{
                label: 'Lượng mưa (mm)',
                data: weather.chart_rain,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e5e7eb' }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

function renderTideChart(tide, dates) {
    const canvas = document.getElementById('tideChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (tideChartInstance) {
        tideChartInstance.destroy();
    }

    tideChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Mực nước triều (m)',
                data: tide.chart_data,
                borderColor: '#06b6d4',
                backgroundColor: 'rgba(6, 182, 212, 0.1)',
                borderWidth: 2,
                pointRadius: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#e5e7eb' }
                },
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        font: { size: 10 }
                    }
                }
            }
        }
    });
}

// AI DIAGNOSIS

async function uploadImage() {
    const fileInput = document.getElementById('camera-input');
    const file = fileInput.files[0];

    if (!file) return;

    const resultSection = document.getElementById('ai-result');
    resultSection.style.display = 'block';

    const preview = document.getElementById('preview-img');
    preview.src = URL.createObjectURL(file);

    document.getElementById('ai-status').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang phân tích...';
    document.getElementById('ai-solution').innerHTML = 'Vui lòng chờ trong giây lát...';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/analyze-image', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        // Update UI
        let statusHTML = result.msg || 'Đã hoàn tất phân tích';
        if (result.status === 'healthy') {
            statusHTML = '✅ ' + statusHTML;
        } else if (result.status === 'diseased') {
            statusHTML = '🔴 ' + statusHTML;
        } else if (result.status === 'pest') {
            statusHTML = '🐛 ' + statusHTML;
        }

        document.getElementById('ai-status').innerHTML = statusHTML;
        document.getElementById('ai-solution').textContent = result.solution || 'Không có khuyến nghị cụ thể.';

    } catch (error) {
        console.error('AI analysis error:', error);
        document.getElementById('ai-status').innerHTML = '❌ Lỗi kết nối';
        document.getElementById('ai-solution').textContent = 'Không thể kết nối đến dịch vụ AI. Vui lòng thử lại sau.';
    }
}

// NAVIGATION

function switchPage(pageName) {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });

    const targetPage = document.getElementById('page-' + pageName);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const targetNav = document.getElementById('nav-' + pageName);
    if (targetNav) {
        targetNav.classList.add('active');
    }

    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetMob = document.getElementById('mob-' + pageName);
    if (targetMob) {
        targetMob.classList.add('active');
    }

    // Load data when switching to certain pages
    if (pageName === 'weather') {
        fetchWeatherData();
    }
}

// UTILITY FUNCTIONS

function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Can be enhanced with toast library
}

// MOBILE MENU TOGGLE (if needed)

function toggleMobileMenu() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}
async function fetchWeatherAI() {
    try {
        const response = await fetch(`/api/weather-prediction?device_id=${userStationId}`);
        const data = await response.json();

        const aiBox = document.getElementById('ai-weather-prediction');
        if (aiBox) {
            // Xóa icon quay tròn và hiện chữ
            aiBox.innerHTML = `<i class="fas fa-magic" style="color:var(--info); margin-right:8px"></i> ${data.prediction}`;
        }
    } catch (error) {
        console.error('AI Weather error:', error);
    }
}