# Load test (Locust)

ยิง 3 การกระทำที่ผู้ใช้ทำบ่อยที่สุด สัดส่วน task อ่าน 80 / เขียน 20

| Task | Weight | Request |
|---|---|---|
| ค้นหาห้อง | 4 | `GET /api/rooms` (สุ่ม `room_type`, `facilities`, `q`) |
| ดูรายละเอียดห้อง | 4 | `GET /api/rooms/:id` + `GET /api/bookings?room_id=&from=&to=` |
| จองห้อง | 2 | `POST /api/bookings` (409 ช่องเวลาชน = ถูกต้อง ไม่นับเป็น fail) |

การจองทุกรายการที่ load test สร้างมี title ขึ้นต้นด้วย `[LOADTEST]`

เลือกยิงเฉพาะบาง task ได้ด้วย tag `list`, `detail`, `write` เช่น `--tags list detail` (อ่านอย่างเดียว ไม่เขียน DB)
หรือ `--exclude-tags write` (ต้องใส่ตอนรันคำสั่ง หน้าเว็บเลือกไม่ได้)

## ติดตั้ง

```bash
python3 -m venv loadtest/.venv
loadtest/.venv/bin/pip install locust
```

## รันบนเครื่อง (backend `STAGE=local`)

```bash
docker compose up -d db
(cd backend-lambda && npm run db:migrate && npm run db:seed && npm run dev)   # terminal 1

source loadtest/.venv/bin/activate                                            # terminal 2
LOADTEST_USERS=6709616541,6709000002,lecturer \
  locust -f loadtest/locustfile.py --host http://localhost:3000
# เปิด http://localhost:8089
```

โหมด dev ส่ง header `X-Dev-User` แทน token จึงใส่แค่ username

## รันกับ prod

บัญชีทดสอบ 10 บัญชี (`6709900001..6`, `claude.sandisk`, `paul.smith`, `mick.ankinson`, `amazon.webservice`)
รหัสผ่านขอในกลุ่มทีม แล้วใส่ใน `loadtest/users.prod.txt` บรรทัดละ `username:password` (ไฟล์นี้ gitignore แล้ว)

```bash
AUTH_MODE=cognito COGNITO_CLIENT_ID=3pjogouj29d6krd1q1qc2dkd39 \
LOADTEST_USERS_FILE=loadtest/users.prod.txt \
locust -f loadtest/locustfile.py --host https://momaff7xr6.execute-api.ap-southeast-1.amazonaws.com/dev
```

`COGNITO_CLIENT_ID` คือ app client `roomres-loadtest` ที่เปิด `USER_PASSWORD_AUTH` ไว้ให้ load test โดยเฉพาะ (ไม่ใช่ client ของหน้าเว็บ)
ไล่จำนวน user ทีละขั้น (5 → 10 → 20 → 50) และดู CloudWatch: Lambda `Throttles`/`ConcurrentExecutions`, RDS `DatabaseConnections`

## สร้าง / ลบบัญชีทดสอบ

บัญชีต้องมีทั้งใน Cognito และในตาราง `User`

```bash
# สร้าง
LOADTEST_PASSWORD='...' loadtest/cognito-users.sh create
loadtest/cognito-users.sh client-create
aws lambda invoke --region ap-southeast-1 --function-name roomres-migrate-dev \
  --cli-binary-format raw-in-base64-out --payload '{"loadtestUsers": true}' out.json && cat out.json

# ลบ: นับก่อน (ค่าเริ่มต้นเป็น dry-run) แล้วค่อยลบจริง
aws lambda invoke ... --payload '{"loadtestCleanup": true}' out.json && cat out.json
aws lambda invoke ... --payload '{"loadtestCleanup": true, "dryRun": false}' out.json && cat out.json
loadtest/cognito-users.sh delete && loadtest/cognito-users.sh client-delete
```

cleanup ลบเฉพาะการจอง `[LOADTEST]` และบัญชีในรายการ `backend-lambda/src/shared/db/loadtest-users.ts`
บัญชีที่ยังผูกกับการจองจริงจะไม่ถูกลบ ส่วน `6709616541` (บัญชี demo) ไม่ถูกแตะ

ปิดโลโก้ตอนเริ่มได้ด้วย `LOADTEST_BANNER=0`
