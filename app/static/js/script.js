// script.js

// Biến lưu mã trạm hiện tại (Mặc định ST-01)
let currentStationId = "ST-01";

// --- 1. LOGIC GIAO DIỆN & ĐĂNG NHẬP ---
function userLogin() {
    const idInput = document.getElementById('device-id').value;
    const modelInput = document.getElementById('farming-model').value;

    // Kiểm tra đầu vào
    if (!idInput) return alert("Vui lòng nhập mã trạm (VD: ST-01, BL-02)");

    // Lưu mã trạm để gọi API thời tiết
    currentStationId = idInput;

    // Hiệu ứng trượt màn hình đăng nhập lên
    document.getElementById('login-screen').style.transform = "translateY(-100%)";

    // Cập nhật thông tin Header
    document.getElementById('disp-loc').innerText = "Trạm: " + idInput;
    document.getElementById('disp-model').innerText = modelInput;

    // Gọi dữ liệu ngay lập tức khi vào
    updateSensorData();
    updateWeatherAndTide();

    // Đặt lịch cập nhật tự động
    setInterval(updateSensorData, 2000); // Cảm biến: 2 giây/lần
    setInterval(updateWeatherAndTide, 60000); // Thời tiết: 60 giây/lần
}

function switchTab(tabId, el) {
    // Xóa active ở các nút cũ
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    // Thêm active cho nút mới bấm
    el.classList.add('active');

    // Ẩn tất cả tab
    document.getElementById('tab-home').style.display = 'none';
    document.getElementById('tab-calendar').style.display = 'none';

    // Hiện tab được chọn
    document.getElementById('tab-' + tabId).style.display = 'block';
}

// --- 2. LẤY DỮ LIỆU CẢM BIẾN (Real-time từ Simulator) ---
async function updateSensorData() {
    try {
        const res = await fetch('/api/get-status');
        const data = await res.json();

        // Cập nhật số liệu lên màn hình
        document.getElementById('val-salinity').innerText = data.salinity;
        document.getElementById('val-temp').innerText = data.temperature + "°C";
        document.getElementById('val-ph').innerText = data.ph;

        // Xử lý Quay kim đồng hồ
        const maxSalinity = 20; // Thang đo tối đa
        let percent = data.salinity / maxSalinity;
        if (percent > 1) percent = 1;
        if (percent < 0) percent = 0;

        // Góc xoay: -90 độ (min) đến 90 độ (max)
        let deg = (percent * 180) - 90;
        document.getElementById('needle').style.transform = `rotate(${deg}deg)`;

        // Xử lý Cảnh báo nguy hiểm
        const alertBox = document.getElementById('danger-alert');
        const alertDot = document.getElementById('alert-dot');

        if (data.is_danger) {
            alertBox.style.display = 'block';
            document.getElementById('danger-msg').innerText = data.alert;
            alertDot.style.display = 'block';
        } else {
            alertBox.style.display = 'none';
            alertDot.style.display = 'none';
        }
    } catch (e) {
        console.log("Đang chờ kết nối cảm biến...");
    }
}

// --- 3. LẤY THỜI TIẾT & THỦY TRIỀU (Từ API Backend) ---
async function updateWeatherAndTide() {
    try {
        // Gọi API kèm theo mã trạm hiện tại
        const res = await fetch(`/api/weather-schedule?device_id=${currentStationId}`);
        const data = await res.json();

        // Cập nhật lại tên trạm chính xác (từ Backend trả về)
        document.getElementById('disp-loc').innerText = "Trạm: " + data.location_name;

        // Render lại nội dung Tab Lịch Vụ
        const calendarHTML = `
            <div class="card">
                <h2 style="color: var(--primary-color); margin-top:0"><i class="fas fa-cloud-sun"></i> Thời tiết thực</h2>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span style="font-size: 40px; font-weight:bold;">${data.weather.temp}°C</span>
                        <p style="margin:0; opacity:0.8;">${data.weather.desc}</p>
                    </div>
                    <i class="fas fa-sun" style="font-size:50px; color:orange;"></i>
                </div>
            </div>

            <div class="card">
                <h2 style="color: #0277bd; margin-top:0"><i class="fas fa-water"></i> Thủy triều & Nước</h2>
                <p style="font-size: 16px; line-height: 1.6;">
                    <b>Ngày:</b> ${data.tide.date}<br>
                    <b>Trạng thái:</b> <span style="color:blue; font-weight:bold">${data.tide.status}</span><br>
                    <b>Mực nước:</b> ${data.tide.level}<br>
                    <hr>
                    <b style="color: #2e7d32;">💡 Khuyến nghị:</b><br>
                    ${data.tide.advice}
                </p>
            </div>
        `;
        document.getElementById('tab-calendar').innerHTML = calendarHTML;

    } catch (e) { console.log("Lỗi lấy thời tiết: " + e); }
}

// --- 4. LOGIC AI VISION ---
async function runAI(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Hiển thị ảnh xem trước
        const reader = new FileReader();
        reader.onload = e => document.getElementById('ai-img').src = e.target.result;
        reader.readAsDataURL(file);

        // Hiển thị khung kết quả & cuộn xuống
        const card = document.getElementById('ai-result-card');
        card.style.display = 'block';
        document.getElementById('ai-status').innerText = "Đang phân tích...";
        document.getElementById('ai-status').style.color = "orange";
        card.scrollIntoView({ behavior: 'smooth' });

        // Đóng gói ảnh gửi lên Server
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/analyze-image', { method: 'POST', body: formData });
            const data = await res.json();

            const isSafe = data.status === 'healthy';
            document.getElementById('ai-status').innerText = isSafe ? "LÚA TỐT ✅" : "CÓ BỆNH ⚠️";
            document.getElementById('ai-status').style.color = isSafe ? "green" : "red";
            document.getElementById('ai-detail').innerText = data.msg + "\n" + (data.solution || "");
        } catch (e) {
            document.getElementById('ai-status').innerText = "Lỗi kết nối!";
        }
    }
}