import subprocess
import re
import time
import sys

print("\n🚀 ĐANG KHỞI ĐỘNG HỆ THỐNG...")
print("⏳ Đang kết nối vệ tinh Cloudflare để lấy link...\n")

# Lệnh chạy cloudflared
command = ["cloudflared", "tunnel", "--url", "http://localhost:8000"]

try:
    # Chạy tiến trình ngầm
    process = subprocess.Popen(
        command,
        stderr=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        encoding='utf-8', 
        errors='ignore'
    )

    # Đọc log để bắt lấy link
    while True:
        line = process.stderr.readline()
        if not line:
            break
        
        if ".trycloudflare.com" in line:
            # Tìm link gốc
            url_match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
            
            if url_match:
                base_url = url_match.group(0)
                
                # --- IN RA 2 LINK RIÊNG BIỆT ---
                print("\n" + "="*70)
                print("✅  HỆ THỐNG ĐÃ ONLINE! DƯỚI ĐÂY LÀ 2 LINK CỦA BẠN:")
                print("="*70)
                
                print(f"\n1️⃣  LINK GIAO DIỆN CHÍNH (Gửi cho Nông dân/Giám khảo):")
                print(f"    👉  {base_url}")
                
                print(f"\n2️⃣  LINK QUẢN TRỊ ADMIN (Dành riêng cho bạn):")
                print(f"    👉  {base_url}/admin")
                
                print("\n" + "="*70)
                print("⚠️  TREO CỬA SỔ NÀY ĐỂ GIỮ MẠNG - ĐỪNG TẮT!\n")
                
                # Giữ chương trình chạy mãi mãi
                while True:
                    time.sleep(1)
            break

except FileNotFoundError:
    print("❌ LỖI: Không tìm thấy 'cloudflared.exe'.")
except KeyboardInterrupt:
    print("\n🛑 Đã tắt hệ thống.")