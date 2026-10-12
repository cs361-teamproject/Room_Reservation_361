## 0. ติดตั้งของที่ต้องมี (ครั้งเดียว)

Windows ทำทุกอย่างใน WSL และเปิด WSL integration ใน Docker Desktop

```bash
# jq / zip — jq ขาดไม่ได้ สคริปต์ deploy อ่าน functions.json ด้วย jq
sudo apt update && sudo apt install -y jq zip unzip curl

# AWS CLI v2 (อย่าใช้ apt install awscli หรือ snap — เป็น v1)
cd /tmp
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip -q awscliv2.zip && sudo ./aws/install && rm -rf awscliv2.zip aws

# Node 22 — Node 18 ใช้ไม่ได้ สคริปต์ใช้ flag --env-file (ต้อง 20.6+)
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc && nvm install 22 && nvm alias default 22
```

ขอ LocalStack auth token (แผน Hobby ฟรี) ที่ https://app.localstack.cloud

```bash
node -v && docker --version && aws --version && jq --version && zip -v | head -1
```

## 1. Credentials

```bash
cp .env.example .env # root — ใช้โดย docker-compose
cp backend-lambda/.env.example backend-lambda/.env
cp frontend/.env.example frontend/.env
```

ใน `.env` ที่ root ใส่:

```env
LOCALSTACK_AUTH_TOKEN=<token ของคุณ>
DB_HOST_PORT=5432
```

ต้องมีก่อน `docker compose up` ไม่งั้น LocalStack ไม่ขึ้น
ถ้าเปลี่ยน `DB_HOST_PORT` ให้แก้พอร์ตใน `DATABASE_URL` ของ `backend-lambda/.env` ด้วย

## 2. Installation

```bash
docker compose up -d db # ที่ root

cd backend-lambda
npm install # เคยลงตอน Node 18 หรือลงจากฝั่ง Windows ให้ rm -rf node_modules ก่อน
npm run db:migrate # สร้างตาราง
npm run db:seed # ข้อมูลตัวอย่าง (rooms, facilities, bookings)
docker compose up -d
npm run photos:local #photo seed to S3

cd ../frontend && npm install
```

## 3. รันแบบแบบไม่ Deploy

```bash
cd backend-lambda && npm run dev # http://localhost:3000/api/health
```

```bash
cd frontend && npm run dev # http://localhost:5173
```

## 4. เช็คว่ารันบน Lambda

```bash
docker compose up -d # ที่ root — ขึ้น localstack ด้วย
cd backend-lambda && npm run deploy:local # ต้องรันใหม่ทุกครั้งที่เปิด docker
curl http://roomres.execute-api.localhost.localstack.cloud:4566/dev/api/health
```

## Extra : ถ้า database มีการเปลี่ยนแปลงให้รันคําสั่งนี้
```
cd backend-lambda
npm run db:fresh    
```

## 5. ทดสอบ API ที่ต้อง login (ตอน local)

ตอน `STAGE=local` (dev server และ LocalStack) ใส่ header `X-Dev-User: <username>` แทนการ login ได้ ส่วนบน AWS header นี้จะถูกเมิน
รายละเอียดและวิธีใช้ใน route ดูที่ [auth-dev-guide.md](auth-dev-guide.md)

| username | role |
|---|---|
| `6709616541`, `6709000002` | STUDENT |
| `lecturer` | LECTURER |
| `staff` | STAFF |
| `admin` | ADMIN |

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H 'Content-Type: application/json' -H 'X-Dev-User: 6709616541' \
  -d '{"room_id":"<id จาก GET /api/rooms>","start_time":"2026-12-01T10:00:00+07:00","end_time":"2026-12-01T12:00:00+07:00","title":"ประชุมกลุ่ม"}'
```

ชุดทดสอบการจอง (401/403/404/400/409/201 และยิงจองช่องเดียวกันพร้อมกัน 10 ครั้ง) ลบข้อมูลที่สร้างเองหลังรันเสร็จ:

```bash
cd backend-lambda
npm run test:bookings   # dev server ต้องรันอยู่ (npm run dev)
API_URL=http://roomres.execute-api.localhost.localstack.cloud:4566/dev/api npm run test:bookings   # LocalStack
```
