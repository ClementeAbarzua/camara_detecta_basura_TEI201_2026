import { randomBytes } from 'node:crypto';
for (const key of ['CAMERA_TOKEN', 'DASHBOARD_PASSWORD', 'SESSION_SECRET']) console.log(key + '=' + randomBytes(24).toString('hex'));
