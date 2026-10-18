# Test cases: `POST /api/bookings` (T5 #118)

ทดสอบเมื่อ 2026-10-12 ด้วย `npm run test:bookings` ([scripts/test/bookings-create.ts](../backend-lambda/scripts/test/bookings-create.ts))

| # | กรณีทดสอบ | ผู้เรียก (`X-Dev-User`) | Input | Expected | Dev server | LocalStack |
|---|---|---|---|---|:-:|:-:|
| 1 | ไม่ได้ login | — | slot ปกติ LC-106 10:00–12:00 | 401 | ✅ PASS | ✅ PASS |
| 2 | ผู้ใช้ไม่มีในระบบ | `nobody-999` | slot ปกติ | 403 | ✅ PASS | ✅ PASS |
| 3 | role ไม่มีสิทธิ์จอง | `staff` | slot ปกติ | 403 | ✅ PASS | ✅ PASS |
| 4 | body ไม่ครบหรือรูปแบบผิด | `6709616541` | ไม่มี `end_time`, `start_time` ไม่มี offset | 400 แจ้งราย field | ✅ PASS | ✅ PASS |
| 5 | ไม่มีห้องนี้ | `6709616541` | `room_id: no-such-room` | 404 | ✅ PASS | ✅ PASS |
| 6 | นักศึกษาจองห้องที่ให้เฉพาะอาจารย์ | `6709616541` | LC-101 (LAB) | 403 "ห้องนี้จองได้เฉพาะอาจารย์" | ✅ PASS | ✅ PASS |
| 7 | ห้องปิดปรับปรุง | `6709616541` | LC-105 (MAINTENANCE) | 400 | ✅ PASS | ✅ PASS |
| 8 | เวลาเริ่มอยู่ในอดีต | `6709616541` | 2020-01-01 10:00–11:00 | 400 | ✅ PASS | ✅ PASS |
| 9 | เวลาจบก่อนเวลาเริ่ม | `6709616541` | 10:00–09:00 | 400 | ✅ PASS | ✅ PASS |
| 10 | นานเกิน `max_hours` | `6709616541` | LC-106 10:00–13:00 (3 ชม. แต่ห้องให้ 2) | 400 "จองได้ไม่เกิน 2 ชั่วโมง" | ✅ PASS | ✅ PASS |
| 11 | จองสำเร็จ | `6709616541` | LC-106 10:00–12:00 | 201, `PENDING`, `STUDENT_BOOKING`, มี title | ✅ PASS | ✅ PASS |
| 12 | จองช่วงเวลาเดิมซ้ำ | `lecturer` | LC-106 10:00–12:00 | 409 | ✅ PASS | ✅ PASS |
| 13 | เวลาทับบางส่วน | `lecturer` | LC-106 11:00–13:00 | 409 | ✅ PASS | ✅ PASS |
| 14 | จองต่อกันพอดี | `lecturer` | LC-106 12:00–13:00 | 201, `CLASS` | ✅ PASS | ✅ PASS |
| 15 | **Race:** ยิงจองช่องเดียวกันพร้อมกัน 10 ครั้ง | `6709616541` | LC-106 15:00–16:00 ×10 | 201 หนึ่งครั้ง, 409 เก้าครั้ง | ✅ PASS | ✅ PASS |
| 16 | การจองแสดงในตารางสาธารณะ | — | `GET /api/bookings?room_id=LC-106` | เห็น 3 รายการ, title ของ `STUDENT_BOOKING` เป็น `null` | ✅ PASS | ✅ PASS |
| 17 | Timeline (audit log) | — | ตรวจตาราง `BookingEvent` | มี `CREATED` 1 แถวต่อการจองที่สำเร็จ (3 แถว) ไม่มีแถวจาก request ที่ล้ม | ✅ PASS | ✅ PASS |

**สรุป:** ผ่าน 17/17 ทั้งบน dev server (`http://localhost:3000/api`) และ LocalStack (`http://roomres.execute-api.localhost.localstack.cloud:4566/dev/api`)

## วิธีรันซ้ำ

```bash
cd backend-lambda
npm run test:bookings   # dev server ต้องรันอยู่ (npm run dev)
API_URL=http://roomres.execute-api.localhost.localstack.cloud:4566/dev/api npm run test:bookings   # LocalStack
```

## หมายเหตุ

- วันที่ใช้ทดสอบสุ่มอยู่ในปี 2031–2032 เพื่อไม่ให้ชนกับ seed (รอบนี้ dev ใช้ 2032-09-12, LocalStack ใช้ 2031-08-27)
- การจองที่ทดสอบ (title ขึ้นต้นด้วย `[test]`) ถูกลบหลังรันเสร็จ
- `X-Dev-User` ใช้ได้เฉพาะ `STAGE=local` ส่วนบน AWS จะใช้ token จาก Cognito ผ่าน API Gateway (T2)

## ตัวอย่าง Request / Response (เคส #11 จองสำเร็จ)

ยิงจริงบน LocalStack เมื่อ 2026-10-12

**Request**

```http
POST /dev/api/bookings
Content-Type: application/json
X-Dev-User: 6709616541
```

```json
{
  "room_id": "3b9d15c2-8c84-4ebc-9ce1-f074aae98e29",
  "start_time": "2026-11-02T10:00:00+07:00",
  "end_time": "2026-11-02T12:00:00+07:00",
  "title": "[test] ประชุมโปรเจกต์กลุ่ม"
}
```

**Response `201 Created`**

```json
{
  "success": true,
  "message": "Booking created successfully",
  "data": {
    "id": "0a662ee2-dcad-4660-aff9-6c14d7f02363",
    "title": "[test] ประชุมโปรเจกต์กลุ่ม",
    "booking_type": "STUDENT_BOOKING",
    "status": "PENDING",
    "start_time": "2026-11-02T03:00:00.000Z",
    "end_time": "2026-11-02T05:00:00.000Z",
    "room": {
      "id": "3b9d15c2-8c84-4ebc-9ce1-f074aae98e29",
      "room_name": "LC-106"
    }
  }
}
```

เวลาใน response เป็น UTC (`10:00+07:00` = `03:00Z`) frontend ต้องแปลงกลับเป็นเวลาไทยก่อนแสดง

**Response `409 Conflict`** เมื่อ `lecturer` ส่ง body เดียวกันซ้ำ (เคส #12)

```json
{
  "success": false,
  "message": "ช่วงเวลานี้มีการจองแล้ว",
  "data": null
}
```
