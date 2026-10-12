# Auth ใน backend: `requireAuth`, `requireRole` และ `X-Dev-User`

เอกสารนี้อธิบายวิธีกันสิทธิ์ของ route ใน `backend-lambda` และวิธีทดสอบ API ที่ต้อง login ตอนที่ Cognito (T1/T2) ยังต่อเข้ากับ backend ไม่เสร็จ

## ภาพรวม

```
                    ┌── บน AWS ──────────────────────────────────────────────┐
Frontend ──token──▶ │ API Gateway (Cognito authorizer ตรวจ token)  ──▶  Lambda │  ← T2 กำลังทำ
                    └────────────────────────────────────────────────────────┘
                    ┌── ตอน local (npm run dev / LocalStack) ─────────────────┐
curl/Postman ──X-Dev-User: 6709616541──▶ Lambda / dev server                │  ← ใช้ได้ตอนนี้
                    └────────────────────────────────────────────────────────┘
```

ทั้งสองทางไปจบที่ middleware ตัวเดียวกันใน [`src/shared/auth/index.ts`](../backend-lambda/src/shared/auth/index.ts) ดังนั้น**โค้ด route ไม่ต้องรู้ว่าผู้ใช้ login มาทางไหน** และไม่ต้องรอ T2 เสร็จก่อนถึงจะเขียน route ได้

## มีอะไรให้ใช้บ้าง

| ตัว | ทำอะไร | ถ้าไม่ผ่าน |
|---|---|---|
| `requireAuth()` | หาว่าใครเรียก แล้วโหลดแถวจากตาราง `User` ใส่ไว้ใน `c.get('user')` | ไม่ได้ login → **401**<br>login แล้วแต่ไม่มี username นี้ใน DB → **403** |
| `requireRole(...roles)` | เช็กว่า role ของผู้ใช้อยู่ในรายการที่กำหนด (ต้องวางต่อจาก `requireAuth()`) | role ไม่ตรง → **403** |
| `c.get('user')` | ข้อมูลผู้เรียก `{ id, username, role, displayName }` | — |

## วิธีใช้ใน route

```ts
import { requireAuth, requireRole } from '../../shared/auth';

// ใครก็ได้ที่ login แล้ว
app.get('/mine', requireAuth(), async (c) => {
  const user = c.get('user')!; // { id, username, role, displayName }
  return c.json(successResponse(await service.listMine(user.id)));
});

// เฉพาะบาง role: requireAuth() ก่อนเสมอ แล้วตามด้วย requireRole()
app.post('/:id/approve', requireAuth(), requireRole('STAFF'), async (c) => { ... });
app.get('/manage', requireAuth(), requireRole('STAFF', 'ADMIN'), async (c) => { ... });
```

**กฎที่ต้องทำตาม**
- ใช้ `user.id` จาก `c.get('user')` เป็นเจ้าของข้อมูลเสมอ **ห้ามรับ `user_id` จาก body หรือ query** ไม่งั้นคนอื่นจะส่ง id ของเพื่อนมาแทนได้
- ใส่ `requireAuth()` **ก่อน** `requireRole()` เสมอ
- route ที่เป็น public (เช่น `GET /api/rooms`) ไม่ต้องใส่อะไร

## `X-Dev-User` คืออะไร

เป็น header ที่ใช้**แทนการ login ตอน local** ใส่ username ของผู้ใช้ใน DB ลงไป ระบบจะทำเหมือนผู้ใช้คนนั้น login อยู่

```
X-Dev-User: 6709616541
```

- ใช้ได้**เฉพาะเมื่อ `STAGE=local`** คือ `npm run dev` และ LocalStack (`FN_ENV_STAGE=local` ใน `infra/env/local.env`)
- บน AWS (`STAGE=dev`/`prod`) header นี้**ถูกเมินทั้งหมด** ต้องใช้ token จาก Cognito เท่านั้น จึงไม่เป็นช่องโหว่ตอน deploy
- พอ T2 เสร็จ จะแก้แค่ฟังก์ชัน `callerUsername()` ในไฟล์เดียว ให้ไปอ่าน `cognito:username` จาก API Gateway ส่วน route ทุกตัวไม่ต้องแก้

### ผู้ใช้ที่มีใน seed

| `X-Dev-User` | role | ใช้ทดสอบ |
|---|---|---|
| `6709616541` | STUDENT | จอง / ดู / ยกเลิกของตัวเอง |
| `6709000002` | STUDENT | นักศึกษาคนที่ 2 ไว้เช็กว่าแก้หรือดูของคนอื่นไม่ได้ |
| `lecturer` | LECTURER | จองห้อง LAB ได้ |
| `staff` | STAFF | อนุมัติ / ปฏิเสธ |
| `admin` | ADMIN | จัดการห้อง กติกา สถิติ |

ถ้า DB ยังไม่มีผู้ใช้ชุดนี้ ให้รัน `npm run db:fresh` ในโฟลเดอร์ `backend-lambda` (คำสั่งนี้ล้างข้อมูลใน DB local)

## วิธีทดสอบ

### 1. curl

```bash
cd backend-lambda && npm run dev     # อีก terminal

# หา id ห้อง
curl -s localhost:3000/api/rooms | jq '.data[] | {id, room_name}'

# จองในฐานะนักศึกษา
curl -X POST localhost:3000/api/bookings \
  -H 'Content-Type: application/json' \
  -H 'X-Dev-User: 6709616541' \
  -d '{"room_id":"<id>","start_time":"2026-11-02T10:00:00+07:00","end_time":"2026-11-02T12:00:00+07:00","title":"ประชุมกลุ่ม"}'
```

ถ้าจะยิงไปที่ LocalStack ให้เปลี่ยน URL เป็น `http://roomres.execute-api.localhost.localstack.cloud:4566/dev/api/...` (ต้องรัน `npm run deploy:local` ก่อน)

### 2. Postman / Thunder Client
ไปที่แท็บ Headers แล้วเพิ่ม key `X-Dev-User` ใส่ value เป็น username จากตารางข้างบน

### 3. Frontend (ระหว่างรอ T3 ทำหน้า login)
ใส่ header ชั่วคราวใน `src/config/axios.ts` ได้ backend อนุญาต header นี้ใน CORS แล้ว **ห้าม commit โค้ดนี้**

```ts
config.headers['X-Dev-User'] = '6709616541'
```

### 4. ชุดทดสอบอัตโนมัติ
ดูตัวอย่างใน [`scripts/test/bookings-create.ts`](../backend-lambda/scripts/test/bookings-create.ts) และผลลัพธ์ใน [test-booking-create.md](test-booking-create.md)

```bash
npm run test:bookings
```

ถ้าเขียนเส้นใหม่ (T6–T10) ให้ copy ไฟล์นี้ไปปรับ โดยใช้ `post(user, body)` เปลี่ยนผู้เรียกในแต่ละเคส

## Error ที่เจอบ่อย

| อาการ | สาเหตุ |
|---|---|
| ได้ 401 ทั้งที่ใส่ `X-Dev-User` แล้ว | `STAGE` ใน `backend-lambda/.env` ไม่ใช่ `local` หรือสะกดชื่อ header ผิด |
| ได้ 403 "This account is not registered in the system" | username นี้ไม่มีในตาราง `User` ให้รัน `npm run db:fresh` หรือเช็กการสะกด |
| ได้ 403 เฉย ๆ | role ไม่อยู่ใน `requireRole(...)` ของ route นั้น เช่น `staff` ไปจองห้อง |
| ได้ 409 "ช่วงเวลานี้มีการจองแล้ว" | ช่วงเวลานั้นมีการจองที่ PENDING หรือ APPROVED อยู่แล้ว (เป็นการทำงานที่ถูกต้อง) |
