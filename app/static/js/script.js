// MEKONG SIGHT AI - ENHANCED FRONTEND

// === CONFIGURATION ===
const FARMING_DATA = {
    rice: {
        name: "Vụ Lúa",
        varieties: {

            st25: {
                name: "Lúa ST24/ST25 (Chịu mặn)",
                stages: {
                    seedling: "Giai đoạn mạ (1–20 ngày)",
                    tillering: "Đẻ nhánh (21–45 ngày)",
                    panicle: "Làm đòng (46–75 ngày)",
                    flowering: "Ra hoa (76–90 ngày)",
                    maturity: "Chín (91–110 ngày)"
                }
            },

            om5451: {
                name: "Lúa OM5451 (Ngọt)",
                stages: {
                    seedling: "Giai đoạn mạ (1–20 ngày)",
                    tillering: "Đẻ nhánh (21–40 ngày)",
                    panicle: "Làm đòng (41–70 ngày)",
                    flowering: "Ra hoa (71–85 ngày)",
                    maturity: "Chín (86–105 ngày)"
                }
            },

            om6976: {
                name: "Lúa OM6976 (Ngọt)",
                stages: {
                    seedling: "Giai đoạn mạ",
                    tillering: "Đẻ nhánh",
                    panicle: "Làm đòng",
                    flowering: "Ra hoa",
                    maturity: "Chín"
                }
            }
        }
    },

    shrimp: {
        name: "Vụ Tôm",
        varieties: {

            tom_su: {
                name: "Tôm Sú (Quảng canh)",
                stages: {
                    postlarval: "Hậu ấu trùng (1–30 ngày)",
                    juvenile: "Tôm con (31–60 ngày)",
                    adult: "Tôm trưởng thành (61–120 ngày)"
                }
            },

            tom_the: {
                name: "Tôm Chân Trắng (Công nghiệp)",
                stages: {
                    postlarval: "Hậu ấu trùng (1–25 ngày)",
                    juvenile: "Tôm con (26–50 ngày)",
                    adult: "Tôm trưởng thành (51–100 ngày)"
                }
            },

            tom_cang_xanh: {
                name: "Tôm Càng Xanh",
                stages: {
                    juvenile: "Tôm non (1–60 ngày)",
                    adult: "Tôm trưởng thành (61–150 ngày)"
                }
            }
        }
    }
};

const STAGE_ADVICE_MAP = {
    'seedling': "Giữ mực nước thấp (1-3cm), chú ý phòng ốc bươu vàng.",
    'tillering': "Bón phân thúc đợt 1. Giữ nước nông để lúa đẻ nhánh khỏe.",
    'panicle': "Bón đón đòng. Giữ mực nước ổn định, phòng bệnh đạo ôn.",
    'flowering': "Giữ nước đủ ẩm. Phòng ngừa lem lép hạt.",
    'maturity': "Rút nước cạn dần. Chuẩn bị thu hoạch.",
    'post_larvae': "Kiểm tra pH/kiềm 2 lần/ngày. Gây màu nước.",
    'grow_out': "Tăng cường quạt nước. Bổ sung khoáng, vitamin.",
    'harvest': "Xi phông đáy ao kỹ. Chuẩn bị lưới thu hoạch."
};

function getCurrentStageFromData(cropType, variety, daysOld) {
    const cropConfig = FARMING_DATA[cropType];
    if (!cropConfig || !cropConfig.varieties[variety]) {
        return { name: "Chưa xác định", advice: "Vui lòng cập nhật giống cây trồng." };
    }

    const stagesObj = cropConfig.varieties[variety].stages;

    for (const [stageKey, stageNameStr] of Object.entries(stagesObj)) {

        const match = stageNameStr.match(/(\d+)[-–](\d+)/);

        if (match) {
            const minDay = parseInt(match[1]);
            const maxDay = parseInt(match[2]);

            if (daysOld >= minDay && daysOld <= maxDay) {
                return {
                    name: stageNameStr,
                    advice: STAGE_ADVICE_MAP[stageKey] || "Theo dõi các chỉ số môi trường thường xuyên."
                };
            }
        }
    }

    return { name: "Đã đến hạn thu hoạch", advice: "Kiểm tra độ chín và tiến hành thu hoạch." };
}


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


let dataInterval = null;
let timeInterval = null;



document.addEventListener("DOMContentLoaded", () => {
    initializeDatetime();
    updateVarieties();
    updateGrowthStages();

    timeInterval = setInterval(updateDatetime, 1000);

    checkAutoLogin();
});

async function checkAutoLogin() {
    const savedUser = localStorage.getItem('mekong_username');

    if (savedUser) {
        console.log('🔄 Đang khôi phục phiên đăng nhập cho:', savedUser);

        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';

        document.getElementById('display-name').textContent = savedUser;

        userName = savedUser;
        initializeSystem(savedUser);
        await loadUserCropData(savedUser);
    }
}

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

            localStorage.setItem('mekong_username', username);

            document.getElementById('login-container').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';

            document.getElementById('display-name').textContent = userName;
            document.getElementById('station-id').textContent = `Trạm: ${userStationId}`;

            if (userRole === 'admin') {
                const adminLink = document.createElement('a');
                adminLink.href = '/admin';
                adminLink.target = '_blank';
                adminLink.className = 'nav-link';
                adminLink.innerHTML = '<i class="fas fa-cog"></i><span>Admin Panel</span>';
                document.querySelector('nav').insertBefore(adminLink, document.querySelector('.logout'));
            }

            initializeSystem(username);
            await loadUserCropData(username);
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
function openRegister() {
    alert("Chức năng đăng ký sẽ cho phép:\n- Tạo tài khoản người dân\n- Gán trạm quan trắc\n- Chọn mô hình Lúa – Tôm\n\nHiện đang ở bản demo.");
}
async function handleRegistration(event) {
    event.preventDefault();

    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const fullName = document.getElementById('reg-fullname').value.trim();
    const stationId = document.getElementById('reg-station').value.trim();
    const errorElement = document.getElementById('register-error');
    const successElement = document.getElementById('register-success');

    if (!username || !password || !fullName || !stationId) {
        errorElement.textContent = 'Vui lòng nhập đủ thông tin';
        errorElement.style.display = 'block';
        if (successElement) successElement.style.display = 'none';
        return;
    }

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                full_name: fullName,
                station_id: stationId
            })
        });

        const data = await response.json();

        if (data.status === 'ok') {
            if (successElement) {
                successElement.textContent = 'Đăng ký thành công! Chuyển về trang đăng nhập...';
                successElement.style.display = 'block';
            }
            errorElement.style.display = 'none';

            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            errorElement.textContent = data.msg || 'Đăng ký không thành công';
            errorElement.style.display = 'block';
            if (successElement) successElement.style.display = 'none';
        }
    } catch (error) {
        console.error('Registration error:', error);
        errorElement.textContent = 'Lỗi kết nối';
        errorElement.style.display = 'block';
        if (successElement) successElement.style.display = 'none';
    }
}

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


async function fetchSensorData() {
    try {
        const response = await fetch(`/api/sensor?device_id=${userStationId}`);
        const data = await response.json();

        updateSensorDisplay(data);
        updateGauge(data.salinity);

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

    if (detailed.overall_score !== undefined) {
        const scoreElem = document.getElementById('overall-score');
        if (scoreElem) {
            scoreElem.textContent = detailed.overall_score;

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

        if (param === 'all' || param === 'salinity') renderChart('salinityChart', data, 'salinity', 'Độ mặn (‰)', '#16a34a');
        if (param === 'all' || param === 'water') renderChart('waterChart', data, 'water', 'Mực nước (cm)', '#3b82f6');

        if (data.stats) {
            updateStatBox('salinity', data.stats.salinity);
            updateStatBox('temperature', data.stats.temperature);
            updateStatBox('ph', data.stats.ph);
            updateStatBox('water', data.stats.water);
        }

    } catch (error) { console.error(error); }
}

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

    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, color + '33');
    gradient.addColorStop(1, color + '00');

    let chartInstance;
    if (canvasId === 'salinityChart') chartInstance = salinityChartInstance;
    else if (canvasId === 'tempChart') chartInstance = tempChartInstance;
    else if (canvasId === 'phChart') chartInstance = phChartInstance;
    else if (canvasId === 'waterChart') chartInstance = waterChartInstance;

    if (chartInstance) {
        chartInstance.destroy();
    }

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

        console.log(' AI Result:', result);

        if (result.status === 'error') {
            document.getElementById('ai-status').innerHTML = '❌ Lỗi: ' + result.msg;
            document.getElementById('ai-solution').textContent = result.solution || 'Vui lòng thử lại sau.';
            return;
        }


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
        console.error('❌ AI analysis error:', error);
        document.getElementById('ai-status').innerHTML = '❌ Lỗi kết nối';
        document.getElementById('ai-solution').textContent = 'Không thể kết nối đến dịch vụ AI. Vui lòng thử lại sau.';
    }
}


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

    if (pageName === 'weather') {
        fetchWeatherData();
    }
}


function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
}


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

            aiBox.innerHTML = `<i class="fas fa-magic" style="color:var(--info); margin-right:8px"></i> ${data.prediction}`;
        }
    } catch (error) {
        console.error('AI Weather error:', error);
    }
}



let currentSeasonInfo = null;

async function fetchSeasonInfo() {
    try {
        const response = await fetch(`/api/season-info?device_id=${userStationId}`);
        const data = await response.json();

        if (data.status === 'ok') {
            currentSeasonInfo = data;
            updateSeasonDisplay(data);
        }
    } catch (error) {
        console.error('Season info error:', error);
    }
}

function updateSeasonDisplay(seasonData) {
    const container = document.getElementById('season-info-container');
    if (!container) return;

    const current = seasonData.current_season;
    const next = seasonData.next_season;
    const rec = seasonData.recommendation;

    let urgencyClass = 'status-safe';
    let urgencyIcon = 'fa-check-circle';

    if (rec.urgency === 'high') {
        urgencyClass = 'status-danger';
        urgencyIcon = 'fa-exclamation-triangle';
    } else if (rec.urgency === 'medium') {
        urgencyClass = 'status-warning';
        urgencyIcon = 'fa-clock';
    }

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">
                    <i class="fas fa-calendar-alt"></i>
                    Lịch Mùa Vụ Luân Canh
                </h3>
            </div>
            
            <div class="season-current" style="padding: 1.5rem; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border-radius: 12px; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.875rem; color: var(--gray-600); font-weight: 600; text-transform: uppercase;">Đang canh tác</div>
                        <h2 style="font-size: 1.75rem; font-weight: 800; color: var(--primary-dark); margin: 0.5rem 0;">
                            ${current.name}
                        </h2>
                        <p style="color: var(--gray-700); font-size: 0.9375rem;">
                            <i class="fas fa-info-circle"></i> ${current.note}
                        </p>
                    </div>
                    <div style="text-align: center;">
                        <div style="width: 80px; height: 80px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                            <i class="fas ${current.crop_type === 'rice' ? 'fa-seedling' : 'fa-fish'}" style="font-size: 2.5rem; color: var(--primary);"></i>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="season-next" style="padding: 1.5rem; background: var(--gray-50); border-radius: 12px; border: 2px dashed var(--gray-300);">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="font-size: 0.875rem; color: var(--gray-600); font-weight: 600; text-transform: uppercase;">Mùa tiếp theo</div>
                        <h3 style="font-size: 1.5rem; font-weight: 700; color: var(--gray-800); margin: 0.5rem 0;">
                            ${next.name}
                        </h3>
                        <p style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 1rem;">
                            Bắt đầu tháng ${next.start_month} • ${next.note}
                        </p>
                        
                        <div class="status-badge ${urgencyClass}" style="display: inline-flex;">
                            <i class="fas ${urgencyIcon}"></i>
                            <span>${rec.message}</span>
                        </div>
                    </div>
                    <div style="background: white; padding: 1rem; border-radius: 12px; text-align: center; min-width: 100px;">
                        <div style="font-size: 2rem; font-weight: 800; color: var(--primary);">${next.days_remaining}</div>
                        <div style="font-size: 0.75rem; color: var(--gray-600); font-weight: 600;">NGÀY NỮA</div>
                    </div>
                </div>
            </div>
            
            <div class="season-actions" style="margin-top: 1.5rem;">
                <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; color: var(--gray-800);">
                    <i class="fas fa-tasks"></i> Công việc cần làm:
                </h4>
                <ul class="alert-list">
                    ${rec.actions.map(action => `
                        <li class="alert-item alert-info">
                            <i class="fas fa-chevron-right"></i>
                            <div class="alert-content">${action}</div>
                        </li>
                    `).join('')}
                </ul>
                
                <button onclick="showSeasonSwitchModal()" class="btn-primary" style="margin-top: 1rem; width: 100%;">
                    <i class="fas fa-exchange-alt"></i> Chuyển mùa vụ thủ công
                </button>
            </div>
        </div>
    `;
}

function showSeasonSwitchModal() {
    const currentMonth = new Date().getMonth() + 1; // 1 - 12
    let suggestedCrop = 'rice';
    let suggestionText = '';


    if (currentMonth >= 5 && currentMonth <= 11) {
        suggestedCrop = 'rice';
        suggestionText = '🌧️ Hiện đang là mùa mưa, thích hợp để <strong>Rửa mặn - Trồng Lúa</strong>.';
    } else {
        suggestedCrop = 'shrimp';
        suggestionText = '☀️ Hiện đang là mùa khô, độ mặn tăng cao, thích hợp để <strong>Nuôi Tôm</strong>.';
    }
    if (!currentSeasonInfo) return;

    const next = currentSeasonInfo.next_season;
    const suggested = next.varieties.map(v => `<option value="${v}">${FARMING_DATA[next.crop_type].varieties[v].name}</option>`).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px; background: white; padding: 2rem; border-radius: 16px; position: relative;">
            <button onclick="this.closest('.modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-600);">
                <i class="fas fa-times"></i>
            </button>
            
            <h3 style="font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem;">
                <i class="fas fa-exchange-alt"></i> Chuyển mùa vụ
            </h3>
            
            <div class="input-group">
                <label>Loại cây trồng mới</label>
                <select id="modal-crop-type" onchange="updateModalVarieties()">
                    <option value="rice" ${next.crop_type === 'rice' ? 'selected' : ''}>Lúa</option>
                    <option value="shrimp" ${next.crop_type === 'shrimp' ? 'selected' : ''}>Tôm</option>
                </select>
            </div>
            
            <div class="input-group">
                <label>Giống đề xuất</label>
                <select id="modal-variety">
                    ${suggested}
                </select>
            </div>
            
            <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                <p style="margin: 0; color: #92400e; font-size: 0.875rem;">
                    <i class="fas fa-info-circle"></i> Lưu ý: Chuyển mùa vụ sẽ thay đổi ngưỡng cảnh báo và khuyến nghị của hệ thống.
                </p>
            </div>
            
            <button onclick="confirmSeasonSwitch()" class="btn-primary" style="width: 100%;">
                Xác nhận chuyển mùa
            </button>
        </div>
    `;

    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;';
    document.body.appendChild(modal);
}

function updateModalVarieties() {
    const cropType = document.getElementById('modal-crop-type').value;
    const varietySelect = document.getElementById('modal-variety');

    varietySelect.innerHTML = '';
    const varieties = FARMING_DATA[cropType].varieties;

    for (const [key, variety] of Object.entries(varieties)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = variety.name;
        varietySelect.appendChild(option);
    }
}

async function confirmSeasonSwitch() {
    const cropType = document.getElementById('modal-crop-type').value;
    const variety = document.getElementById('modal-variety').value;

    const today = new Date().toISOString().split('T')[0];
    const username = localStorage.getItem('mekong_username');

    if (!username) {
        alert("Vui lòng đăng nhập lại!");
        return;
    }

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/switch-season', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                crop_type: cropType,
                variety: variety,
                start_date: today
            })
        });

        const result = await response.json();

        if (result.status === 'ok') {
            alert('✅ ' + result.msg);

            document.getElementById('crop-type').value = cropType;
            updateVarieties();
            setTimeout(() => {
                document.getElementById('crop-variety').value = variety;
                updateThresholds();
            }, 100);


            const modal = document.querySelector('.modal-overlay');
            if (modal) modal.remove();


            loadUserCropData(username);
        } else {
            alert('❌ Lỗi: ' + result.msg);
        }
    } catch (error) {
        console.error('Switch season error:', error);
        alert('Lỗi kết nối máy chủ');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}


function initializeSystem() {
    fetchSensorData();
    fetchWeatherData();
    fetchHistory(currentRange, currentParam);
    fetchWeatherAI();
    fetchSeasonInfo();

    dataInterval = setInterval(() => {
        fetchSensorData();
    }, 3000);

    setInterval(() => {
        fetchWeatherData();
        fetchSeasonInfo();
    }, 600000);
}

function getStageInfo(cropType, variety, days) {
    const adviceMap = {
        'seedling': "Giữ mực nước 1-3cm, phòng ốc bươu vàng.",
        'tillering': "Bón phân đợt 1, giữ nước nông.",
        'panicle': "Bón đón đòng, giữ nước ổn định.",
        'flowering': "Giữ đủ ẩm, phòng lem lép hạt.",
        'maturity': "Rút nước cạn dần để chuẩn bị thu hoạch.",
        'harvest': "Đã đến lúc thu hoạch."
    };

    if (FARMING_DATA[cropType] && FARMING_DATA[cropType].varieties[variety]) {
        const stages = FARMING_DATA[cropType].varieties[variety].stages;

        for (const [key, label] of Object.entries(stages)) {
            const match = label.match(/(\d+)[-–](\d+)/);
            if (match) {
                const min = parseInt(match[1]);
                const max = parseInt(match[2]);
                if (days >= min && days <= max) {
                    return { name: label, advice: adviceMap[key] || "Theo dõi thường xuyên." };
                }
            }
        }
    }
    return { name: "Đã thu hoạch / Chờ vụ mới", advice: "Cải tạo đất/nước cho vụ sau." };
}

async function loadUserCropData(username) {
    try {
        const response = await fetch(`/api/get-crop-season?username=${username}`);
        const result = await response.json();

        if (result.status === 'ok' && result.crop_data) {
            const data = result.crop_data;

            const plantingDateStr = data.planting_date;
            if (!plantingDateStr) return;

            const start = new Date(plantingDateStr);
            const now = new Date();
            const days = Math.ceil((now - start) / (1000 * 60 * 60 * 24));

            const pParts = plantingDateStr.split('-');
            const displayDate = `${pParts[2]}/${pParts[1]}/${pParts[0]}`;

            let cycleLength = 110;
            if (FARMING_DATA[data.crop_type] &&
                FARMING_DATA[data.crop_type].varieties[data.variety]) {
                const varietyData = FARMING_DATA[data.crop_type].varieties[data.variety];
                if (data.crop_type === 'rice') cycleLength = 110;
                if (data.crop_type === 'shrimp') cycleLength = 100;
            }

            const harvestDate = new Date(start);
            harvestDate.setDate(harvestDate.getDate() + cycleLength);
            const hDateStr = harvestDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

            let stageName = "Đang phát triển";
            let advice = "Theo dõi các chỉ số môi trường thường xuyên.";

            if (typeof getStageInfo === "function") {
                const stageInfo = getStageInfo(data.crop_type, data.variety, days);
                stageName = stageInfo.name;
                advice = stageInfo.advice;
            }

            if (document.getElementById('ss-start-date'))
                document.getElementById('ss-start-date').textContent = displayDate;

            if (document.getElementById('ss-days-count')) {
                const displayDays = days >= 0 ? days : 0;
                document.getElementById('ss-days-count').textContent = `${displayDays} ngày`;
            }

            if (document.getElementById('ss-harvest-date'))
                document.getElementById('ss-harvest-date').textContent = hDateStr;

            if (document.getElementById('ss-stage-name'))
                document.getElementById('ss-stage-name').textContent = stageName;

            if (document.getElementById('stage-advice'))
                document.getElementById('stage-advice').innerHTML = `<i class="fas fa-leaf"></i> <b>Khuyến nghị:</b> ${advice}`;

            let percent = Math.round((days / cycleLength) * 100);

            percent = Math.max(0, Math.min(100, percent));

            if (document.getElementById('progress-text'))
                document.getElementById('progress-text').textContent = `${percent}%`;

            const circle = document.getElementById('progress-circle-path');
            if (circle) {
                circle.setAttribute('stroke-dasharray', `${percent}, 100`);
            }

            const typeSelect = document.getElementById('crop-type');
            if (typeSelect && !typeSelect.disabled) {
                typeSelect.value = data.crop_type;
                updateVarieties();
                setTimeout(() => {
                    const varSelect = document.getElementById('crop-variety');
                    if (varSelect) varSelect.value = data.variety;
                }, 100);
            }

        } else {
            if (document.getElementById('stage-advice'))
                document.getElementById('stage-advice').innerHTML = `<i class="fas fa-exclamation-circle"></i> Chưa có dữ liệu mùa vụ.`;
            if (document.getElementById('ss-days-count'))
                document.getElementById('ss-days-count').textContent = "0 ngày";
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu mùa vụ:", error);
    }
}

function getStageColor(progress) {
    if (progress < 30) return '#3b82f6';
    if (progress < 60) return '#10b981';
    if (progress < 90) return '#f59e0b';
    return '#eab308';
}
function displayAutoStageInfo(autoStage, daysSince, plantingDate) {
    const container = document.getElementById('season-info-container');
    if (!container) {
        console.error('❌ Không tìm thấy season-info-container');
        return;
    }

    const plantDate = new Date(plantingDate);
    const formattedDate = plantDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const cropType = document.getElementById('crop-type').value;
    const variety = document.getElementById('crop-variety').value;
    const cycleLength = FARMING_DATA[cropType].varieties[variety].cycle || 110;
    const harvestDate = new Date(plantDate);
    harvestDate.setDate(harvestDate.getDate() + cycleLength);
    const formattedHarvestDate = harvestDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    let stageColor = '#10b981';
    let stageIcon = 'fa-seedling';

    if (autoStage.progress < 30) {
        stageColor = '#3b82f6';
        stageIcon = 'fa-seedling';
    } else if (autoStage.progress < 60) {
        stageColor = '#10b981';
        stageIcon = 'fa-leaf';
    } else if (autoStage.progress < 90) {
        stageColor = '#f59e0b';
        stageIcon = 'fa-wheat-awn';
    } else {
        stageColor = '#eab308';
        stageIcon = 'fa-check-circle';
    }

    container.innerHTML = `
        <div class="card" style="background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 2px solid ${stageColor}; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: start; padding: 1.5rem;">
                <div>
                    <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fas ${stageIcon}" style="color: ${stageColor};"></i> Thông tin mùa vụ hiện tại
                    </h3>
                    
                    <div style="display: grid; gap: 0.75rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: white; border-radius: 8px;">
                            <i class="fas fa-calendar-plus" style="color: ${stageColor}; width: 20px;"></i>
                            <span style="color: var(--gray-700); font-weight: 500;">Ngày gieo/thả:</span>
                            <strong style="color: var(--gray-900);">${formattedDate}</strong>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: white; border-radius: 8px;">
                            <i class="fas fa-clock" style="color: ${stageColor}; width: 20px;"></i>
                            <span style="color: var(--gray-700); font-weight: 500;">Số ngày canh tác:</span>
                            <strong style="color: ${stageColor}; font-size: 1.125rem;">${daysSince} ngày</strong>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: white; border-radius: 8px;">
                            <i class="fas fa-chart-line" style="color: ${stageColor}; width: 20px;"></i>
                            <span style="color: var(--gray-700); font-weight: 500;">Giai đoạn:</span>
                            <strong style="color: ${stageColor};">${autoStage.name}</strong>
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem; background: white; border-radius: 8px;">
                            <i class="fas fa-calendar-check" style="color: var(--gray-600); width: 20px;"></i>
                            <span style="color: var(--gray-700); font-weight: 500;">Dự kiến thu hoạch:</span>
                            <strong style="color: var(--gray-900);">${formattedHarvestDate}</strong>
                        </div>
                    </div>
                </div>
                
                <!-- Progress Circle -->
                <div style="text-align: center; min-width: 140px;">
                    <div style="font-size: 0.75rem; font-weight: 600; color: var(--gray-600); text-transform: uppercase; margin-bottom: 0.5rem;">
                        Tiến độ
                    </div>
                    <div style="position: relative; width: 120px; height: 120px; margin: 0 auto;">
                        <svg viewBox="0 0 120 120" style="transform: rotate(-90deg);">
                            <circle cx="60" cy="60" r="54" fill="none" stroke="#e5e7eb" stroke-width="8"/>
                            <circle cx="60" cy="60" r="54" fill="none" stroke="${stageColor}" stroke-width="8"
                                stroke-dasharray="339.292" stroke-dashoffset="${339.292 * (1 - autoStage.progress / 100)}"
                                stroke-linecap="round" style="transition: stroke-dashoffset 1s ease;"/>
                        </svg>
                        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                            <div style="font-size: 1.75rem; font-weight: 800; color: ${stageColor};">${autoStage.progress}%</div>
                            <div style="font-size: 0.75rem; color: var(--gray-600); font-weight: 600;">hoàn thành</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    console.log('✅ Đã hiển thị thông tin mùa vụ:', autoStage);
}

function lockCropSelectors() {
    document.getElementById('crop-type').disabled = true;
    document.getElementById('crop-variety').disabled = true;

    const cropSelector = document.querySelector('.crop-selector');
    if (cropSelector && !document.getElementById('btn-change-season')) {
        const changeBtn = document.createElement('a');
        changeBtn.id = 'btn-change-season';
        changeBtn.href = '/crop-management';
        changeBtn.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            border-radius: 10px;
            font-size: 0.9375rem;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
        `;
        changeBtn.innerHTML = '<i class="fas fa-edit"></i> Chỉnh sửa mùa vụ';

        changeBtn.onmouseover = function () {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 6px 16px rgba(5, 150, 105, 0.4)';
        };
        changeBtn.onmouseout = function () {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 12px rgba(5, 150, 105, 0.3)';
        };

        const selectorItem = document.createElement('div');
        selectorItem.className = 'crop-selector-item';
        selectorItem.style.display = 'flex';
        selectorItem.style.alignItems = 'flex-end';
        selectorItem.appendChild(changeBtn);
        cropSelector.appendChild(selectorItem);
    }
}

function showCropSetupPrompt() {
    const cropSelector = document.querySelector('.crop-selector');
    if (cropSelector && !document.getElementById('setup-prompt')) {
        const prompt = document.createElement('div');
        prompt.id = 'setup-prompt';
        prompt.style.cssText = `
            grid-column: 1 / -1;
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 2px solid #f59e0b;
            padding: 1rem;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        `;
        prompt.innerHTML = `
            <div>
                <i class="fas fa-exclamation-triangle" style="color: #f59e0b; margin-right: 0.5rem;"></i>
                <strong>Chưa thiết lập mùa vụ.</strong> Vui lòng nhập thông tin để hệ thống tự động theo dõi.
            </div>
            <a href="/crop-management" class="btn-primary" style="white-space: nowrap; padding: 0.5rem 1rem; margin: 0;">
                Thiết lập ngay
            </a>
        `;
        cropSelector.appendChild(prompt);
    }
}


function updateVarietiesInModal() {
    const cropType = document.getElementById('crop-type-modal').value;
    const varietySelect = document.getElementById('variety-modal');

    varietySelect.innerHTML = '<option value="">-- Chọn giống --</option>';

    if (!cropType) return;

    const varieties = FARMING_DATA[cropType].varieties;
    for (const [key, variety] of Object.entries(varieties)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = variety.name;
        varietySelect.appendChild(option);
    }
}

function updateGrowthInfoInModal() {
    calculateCurrentStageInModal();
}

function calculateCurrentStageInModal() {
    const plantingDate = document.getElementById('planting-date-modal').value;
    const cropType = document.getElementById('crop-type-modal').value;
    const variety = document.getElementById('variety-modal').value;

    if (!plantingDate || !cropType || !variety) return;

    const planted = new Date(plantingDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((today - planted) / (1000 * 60 * 60 * 24));

    if (isNaN(daysDiff) || daysDiff < 0) {
        alert('⚠️ Ngày gieo không hợp lệ!');
        document.getElementById('planting-date-modal').value = '';
        document.getElementById('current-stage-info-modal').style.display = 'none';
        return;
    }

    if (daysDiff > 730) {
        if (!confirm('⚠️ Ngày gieo quá 2 năm trước. Tiếp tục?')) {
            document.getElementById('planting-date-modal').value = '';
            document.getElementById('current-stage-info-modal').style.display = 'none';
            return;
        }
    }

    document.getElementById('days-count-modal').textContent = daysDiff;

    let stageName = "Chưa xác định";
    let progress = 0;
    let stageColor = '#10b981';

    const cycleData = FARMING_DATA[cropType].varieties[variety];
    const cycleLength = cycleData.cycle || 110;

    if (cropType === 'rice') {
        if (daysDiff <= 20) {
            stageName = "Giai đoạn mạ";
            progress = Math.round((daysDiff / 20) * 100);
            stageColor = '#3b82f6';
        } else if (daysDiff <= 45) {
            stageName = "Đẻ nhánh";
            progress = Math.round(((daysDiff - 20) / 25) * 100);
            stageColor = '#10b981';
        } else if (daysDiff <= 75) {
            stageName = "Làm đòng";
            progress = Math.round(((daysDiff - 45) / 30) * 100);
            stageColor = '#f59e0b';
        } else if (daysDiff <= 90) {
            stageName = "Ra hoa";
            progress = Math.round(((daysDiff - 75) / 15) * 100);
            stageColor = '#ec4899';
        } else if (daysDiff <= cycleLength) {
            stageName = "Chín";
            progress = Math.round(((daysDiff - 90) / (cycleLength - 90)) * 100);
            stageColor = '#eab308';
        } else {
            stageName = "⚠️ Đã quá hạn thu hoạch";
            progress = 100;
            stageColor = '#ef4444';
        }
    } else if (cropType === 'shrimp') {
        const maxDays = cycleLength;
        if (daysDiff <= Math.floor(maxDays * 0.25)) {
            stageName = "Hậu ấu trùng";
            progress = Math.round((daysDiff / (maxDays * 0.25)) * 100);
            stageColor = '#3b82f6';
        } else if (daysDiff <= Math.floor(maxDays * 0.5)) {
            stageName = "Tôm con";
            progress = Math.round(((daysDiff - maxDays * 0.25) / (maxDays * 0.25)) * 100);
            stageColor = '#10b981';
        } else if (daysDiff <= maxDays) {
            stageName = "Tôm trưởng thành";
            progress = Math.round(((daysDiff - maxDays * 0.5) / (maxDays * 0.5)) * 100);
            stageColor = '#f59e0b';
        } else {
            stageName = "⚠️ Đã quá hạn thu hoạch";
            progress = 100;
            stageColor = '#ef4444';
        }
    }

    const stageNameElem = document.getElementById('stage-name-modal');
    stageNameElem.textContent = stageName;
    stageNameElem.style.color = stageColor;

    document.getElementById('stage-progress-modal').textContent = progress;

    const progressFill = document.getElementById('progress-fill-modal');
    progressFill.style.width = progress + '%';
    progressFill.style.background = `linear-gradient(90deg, ${stageColor}, ${stageColor}cc)`;

    document.getElementById('current-stage-info-modal').style.display = 'block';
}

async function handleSaveCropSeasonInDashboard(event) {
    event.preventDefault();

    const cropType = document.getElementById('crop-type-modal').value;
    const variety = document.getElementById('variety-modal').value;
    const plantingDate = document.getElementById('planting-date-modal').value;

    if (!cropType || !variety || !plantingDate) {
        alert(' Vui lòng điền đầy đủ thông tin!');
        return;
    }

    const username = localStorage.getItem('mekong_username');
    if (!username) {
        alert(' Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
        window.location.href = '/login';
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';

    try {
        const response = await fetch('/api/save-crop-season', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                crop_type: cropType,
                variety: variety,
                planting_date: plantingDate
            })
        });

        const result = await response.json();

        if (result.status === 'ok') {
            document.getElementById('crop-success-message').style.display = 'flex';

            // Cập nhật dropdown chính
            document.getElementById('crop-type').value = cropType;
            updateVarieties();
            setTimeout(() => {
                document.getElementById('crop-variety').value = variety;
                updateThresholds();
            }, 100);

            // Reload thông tin mùa vụ
            await loadUserCropData(username);

            setTimeout(() => {
                document.getElementById('crop-success-message').style.display = 'none';
                event.target.reset();
                document.getElementById('current-stage-info-modal').style.display = 'none';
            }, 3000);

        } else {
            alert(' Lỗi: ' + (result.message || 'Không thể lưu dữ liệu'));
        }

    } catch (error) {
        console.error(' Save error:', error);
        alert(' Lỗi kết nối. Vui lòng thử lại.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}
async function loadUserCropDataInCropPage(username) {
    try {
        const response = await fetch(`/api/get-crop-season?username=${username}`);
        const result = await response.json();

        if (result.status === 'ok' && result.crop_data) {
            displayCropSeasonInfo(result);
        } else {
            displayNoCropSeasonInfo();
        }
    } catch (error) {
        console.error(' Load crop data error:', error);
        displayNoCropSeasonInfo();
    }
}

function displayCropSeasonInfo(data) {
    const container = document.getElementById('crop-season-info-container');
    if (!container) return;

    const cropData = data.crop_data;
    const autoStage = data.auto_stage;
    const daysSince = data.days_since_planting;

    const plantDate = new Date(cropData.planting_date);
    const formattedDate = plantDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const cropType = cropData.crop_type;
    const variety = cropData.variety;
    const cycleLength = FARMING_DATA[cropType].varieties[variety].cycle || 110;

    const harvestDate = new Date(plantDate);
    harvestDate.setDate(harvestDate.getDate() + cycleLength);
    const formattedHarvestDate = harvestDate.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const daysRemaining = Math.max(0, cycleLength - daysSince);

    let stageColor = '#10b981';
    let stageIcon = 'fa-seedling';

    if (autoStage.progress < 30) {
        stageColor = '#3b82f6';
        stageIcon = 'fa-seedling';
    } else if (autoStage.progress < 60) {
        stageColor = '#10b981';
        stageIcon = 'fa-leaf';
    } else if (autoStage.progress < 90) {
        stageColor = '#f59e0b';
        stageIcon = 'fa-wheat-awn';
    } else {
        stageColor = '#eab308';
        stageIcon = 'fa-check-circle';
    }

    const cropTypeName = cropType === 'rice' ? 'Lúa' : 'Tôm';
    const varietyName = FARMING_DATA[cropType].varieties[variety].name;

    container.innerHTML = `
        <div class="crop-season-card">
            <div class="crop-season-header">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.5rem;">
                        <i class="fas ${stageIcon}" style="color: ${stageColor};"></i> Mùa vụ hiện tại
                    </h2>
                    <p style="color: var(--gray-600); font-size: 1rem;">
                        ${cropTypeName} - ${varietyName}
                    </p>
                </div>
                
                <div class="progress-circle">
                    <svg viewBox="0 0 140 140" style="transform: rotate(-90deg);">
                        <circle cx="70" cy="70" r="60" fill="none" stroke="#e5e7eb" stroke-width="10"/>
                        <circle cx="70" cy="70" r="60" fill="none" stroke="${stageColor}" stroke-width="10"
                            stroke-dasharray="376.99" stroke-dashoffset="${376.99 * (1 - autoStage.progress / 100)}"
                            stroke-linecap="round" style="transition: stroke-dashoffset 1s ease;"/>
                    </svg>
                    <div class="progress-circle-value">
                        <div class="progress-circle-number">${autoStage.progress}%</div>
                        <div class="progress-circle-label">Hoàn thành</div>
                    </div>
                </div>
            </div>
            
            <div class="crop-season-details">
                <div class="crop-detail-item">
                    <div class="crop-detail-icon">
                        <i class="fas fa-calendar-plus"></i>
                    </div>
                    <div class="crop-detail-content">
                        <div class="crop-detail-label">Ngày gieo/thả</div>
                        <div class="crop-detail-value">${formattedDate}</div>
                    </div>
                </div>
                
                <div class="crop-detail-item">
                    <div class="crop-detail-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="crop-detail-content">
                        <div class="crop-detail-label">Đã canh tác</div>
                        <div class="crop-detail-value" style="color: ${stageColor};">${daysSince} ngày</div>
                    </div>
                </div>
                
                <div class="crop-detail-item">
                    <div class="crop-detail-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="crop-detail-content">
                        <div class="crop-detail-label">Giai đoạn</div>
                        <div class="crop-detail-value" style="color: ${stageColor};">${autoStage.name}</div>
                    </div>
                </div>
                
                <div class="crop-detail-item">
                    <div class="crop-detail-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="crop-detail-content">
                        <div class="crop-detail-label">Dự kiến thu hoạch</div>
                        <div class="crop-detail-value">${formattedHarvestDate}</div>
                    </div>
                </div>
                
                <div class="crop-detail-item">
                    <div class="crop-detail-icon" style="background: ${daysRemaining <= 10 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'};">
                        <i class="fas fa-hourglass-half"></i>
                    </div>
                    <div class="crop-detail-content">
                        <div class="crop-detail-label">Còn lại</div>
                        <div class="crop-detail-value" style="color: ${daysRemaining <= 10 ? '#ef4444' : '#10b981'};">${daysRemaining} ngày</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
function showCropSetupPrompt() {
    const container = document.getElementById('season-info-panel');
    if (!container) return;

    const prompt = document.createElement('div');
    prompt.style.cssText = `
        background: linear-gradient(135deg, #fef3c7, #fde68a);
        border: 2px solid #f59e0b;
        padding: 1.5rem;
        border-radius: 12px;
        text-align: center;
        margin-top: 1rem;
    `;
    prompt.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="color: #f59e0b; font-size: 2rem; margin-bottom: 0.5rem;"></i>
        <p style="font-weight: 700; margin-bottom: 1rem;">Chưa thiết lập mùa vụ</p>
        <a href="/crop-management" class="btn-primary">
            <i class="fas fa-seedling"></i> Thiết lập ngay
        </a>
    `;

    container.appendChild(prompt);
}