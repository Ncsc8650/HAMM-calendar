# กกมง.กง.กห. — แผนกสารสนเทศพิเศษ

เว็บปฏิทินแบบอ่านอย่างเดียวจาก Google Calendar ของ `ditsadon8650@gmail.com` โดยขอสิทธิ์ในเบราว์เซอร์ด้วย Google Identity Services ข้อมูลกิจกรรมและ access token ไม่ถูกบันทึกใน repository หรือ localStorage

## เริ่มใช้งาน

1. สร้างโปรเจกต์ใน [Google Cloud Console](https://console.cloud.google.com/) และเปิด Google Calendar API
2. ตั้งค่า Google Auth Platform (Branding, Audience, Data Access) เพิ่ม scope `https://www.googleapis.com/auth/calendar.readonly`, `openid` และ `email` หากแอปอยู่โหมด Testing ให้เพิ่ม `ditsadon8650@gmail.com` เป็น test user
3. สร้าง OAuth client ID ชนิด Web application และเพิ่ม Authorized JavaScript origins เช่น `http://localhost:4173` หรือ `https://ncsc8650.github.io` (ไม่มี path)
4. เปิดเว็บ กด “ตั้งค่าการเชื่อมต่อ” กรอก OAuth Client ID กดเชื่อมต่อ และเลือกบัญชี `ditsadon8650@gmail.com`

ไม่ต้องใช้ client secret หรือ API key และห้ามใส่ client secret ในเว็บ

## ทดลองในเครื่อง

รัน `python3 -m http.server 4173` ในโฟลเดอร์นี้ แล้วเปิด `http://localhost:4173` การเปิดผ่าน `file://` ใช้ OAuth ไม่ได้

## GitHub Pages

เว็บ static นี้ไม่ต้อง build หลังนำโค้ดเข้ากิ่ง `main` แล้ว ตั้ง Settings → Pages → Deploy from a branch → `main` → `/ (root)` เว็บจะอยู่ที่ `https://ncsc8650.github.io/HAMM-calendar/` และต้องเพิ่ม `https://ncsc8650.github.io` เป็น Authorized JavaScript origin ใน Google Cloud เจ้าของบัญชีต้องกดยินยอมจากหน้าเว็บก่อนจึงอ่านข้อมูลได้

## ขอบเขต

- แสดงเฉพาะปฏิทินหลักตามเวลาไทย มีมุมมองเดือน รายการค้นหา กรองประเภท และเปิดรายการต้นฉบับ
- ไม่เพิ่ม แก้ไข ลบ หรือเปลี่ยนสีรายการ การรีเฟรชหน้าจะต้องเชื่อมบัญชีใหม่ เพราะ token อยู่ในหน่วยความจำเท่านั้น
- การตรวจอีเมลในเบราว์เซอร์ช่วยป้องกันเลือกบัญชีผิด ไม่ใช่ระบบควบคุมสิทธิ์ฝั่ง server หากต้องการให้ผู้ใช้หลายคนเข้าถึงตามบทบาท ต้องมี backend ที่ตรวจสิทธิ์

อ้างอิง: [Google Identity Services token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [OAuth Client ID](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), [Calendar events.list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
