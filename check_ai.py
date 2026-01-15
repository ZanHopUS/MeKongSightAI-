import google.generativeai as genai

# DÁN KEY CỦA BẠN VÀO ĐÂY ĐỂ KIỂM TRA
GOOGLE_API_KEY = "AIzaSyBcFLMarebH0D6mm6fyP3RKdriyFkIP3vc"
genai.configure(api_key=GOOGLE_API_KEY)

print("--- ĐANG KIỂM TRA DANH SÁCH MODEL ---")
try:
    found = False
    for m in genai.list_models():
        # Chỉ liệt kê các model hỗ trợ tạo nội dung (generateContent)
        if 'generateContent' in m.supported_generation_methods:
            print(f" Tìm thấy: {m.name}")
            found = True
    
    if not found:
        print(" Không tìm thấy model nào! Kiểm tra lại API Key hoặc Mạng.")
        
except Exception as e:
    print(f" LỖI NGHIÊM TRỌNG: {e}")