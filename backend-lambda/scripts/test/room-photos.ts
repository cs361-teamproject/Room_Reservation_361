// End-to-end checks for the room photo endpoints (T9.1) against a running API, local only.
//   npm run test:photos                         dev server (npm run dev) + LocalStack S3
//   API_URL=<localstack url>/api npm run test:photos
// Logs in with X-Dev-User (STAGE=local). Puts the room's photos back the way they were.

const API_URL = (process.env.API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
const STAFF = 'staff';
const STUDENT = '6709616541';

let failed = 0;
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      ${JSON.stringify(detail)}`}`);
};

type Photo = { id: string; url: string };
type Upload = { upload_url: string; fields: Record<string, string>; object_key: string };

async function call<T>(method: string, path: string, user: string | null, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(user && { 'X-Dev-User': user }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { message: unknown; data: T } };
}

/** The browser side of a presigned POST: the signed fields first, the file last */
async function postToS3(upload: Upload, bytes: Uint8Array, type: string, override: Record<string, string> = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...upload.fields, ...override })) form.append(k, v);
  form.append('file', new Blob([bytes], { type }), 'photo');
  return (await fetch(upload.upload_url, { method: 'POST', body: form })).status;
}

// Smallest valid PNG (1x1)
const PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

const rooms = (await call<Array<{ id: string; room_name: string; photos: Photo[] }>>('GET', '/rooms', null)).body.data;
const room = rooms.find((r) => r.room_name === 'LC-106')!;
const other = rooms.find((r) => r.room_name === 'LC-101')!;
const before = room.photos.map((p) => p.id);
const base = `/rooms/${room.id}/photos`;
let added: Photo | undefined;

console.log(`API ${API_URL}, room ${room.room_name} with ${before.length} photos\n`);
try {
  let r = await call<Upload>('POST', `${base}/upload-url`, STUDENT, { content_type: 'image/png', size: PNG.length });
  check('student cannot upload -> 403', r.status === 403, r);

  r = await call<Upload>('POST', `${base}/upload-url`, STAFF, { content_type: 'image/gif', size: 10 });
  check('gif -> 400', r.status === 400, r);

  r = await call<Upload>('POST', `${base}/upload-url`, STAFF, { content_type: 'image/png', size: 6 * 1024 * 1024 });
  check('declared 6 MB -> 400', r.status === 400, r);

  r = await call<Upload>('POST', `${base}/upload-url`, STAFF, { content_type: 'image/png', size: PNG.length });
  const upload = r.body.data;
  check('upload-url -> 201 with fields and a key under rooms/<id>/', r.status === 201 && upload.object_key.startsWith(`rooms/${room.id}/`) && Boolean(upload.fields.Policy), r);

  check('S3 refuses a file over 5 MB', (await postToS3(upload, new Uint8Array(5 * 1024 * 1024 + 1), 'image/png')) >= 400);
  // S3 checks the signed Content-Type form field (the policy), not the file part's own type
  check('S3 refuses a changed Content-Type field', (await postToS3(upload, PNG, 'text/html', { 'Content-Type': 'text/html' })) >= 400);
  const put = await postToS3(upload, PNG, 'image/png');
  check('browser POST to S3 -> 2xx', put >= 200 && put < 300, put);

  let p = await call<Photo[]>('POST', `/rooms/${other.id}/photos`, STAFF, { object_key: upload.object_key });
  check("another room's key -> 400", p.status === 400, p);

  p = await call<Photo[]>('POST', base, STAFF, { object_key: upload.object_key });
  added = p.body.data?.at(-1);
  check('register -> 201, added last', p.status === 201 && p.body.data.length === before.length + 1, p);
  check('the photo URL serves the file', added ? (await fetch(added.url)).status === 200 : false, added);

  p = await call<Photo[]>('POST', base, STAFF, { object_key: upload.object_key });
  check('register the same key again -> 409', p.status === 409, p);

  p = await call<Photo[]>('PATCH', `${base}/order`, STAFF, { ids: [added!.id, ...before] });
  check('reorder -> new photo is the cover', p.status === 200 && p.body.data[0]?.id === added!.id, p);

  p = await call<Photo[]>('PATCH', `${base}/order`, STAFF, { ids: [added!.id] });
  check('reorder with missing ids -> 400', p.status === 400, p);

  p = await call<Photo[]>('DELETE', `/rooms/${other.id}/photos/${added!.id}`, STAFF);
  check("delete through another room -> 404", p.status === 404, p);

  p = await call<Photo[]>('DELETE', `${base}/${added!.id}`, STAFF);
  check('delete -> 200, back to the original photos', p.status === 200 && p.body.data.map((x) => x.id).join() === before.join(), p);
  check('uploaded file removed from S3', (await fetch(added!.url)).status === 404);
  added = undefined;
} finally {
  if (added) await call('DELETE', `${base}/${added.id}`, STAFF);
  if (before.length) await call('PATCH', `${base}/order`, STAFF, { ids: before });
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);

export {};
