#!/usr/bin/env node
// scripts/onshape-upload.js
// 用 Onshape REST API 一键创建文档 + Feature Studio + 上传 woodstock-frame.fs
//
// 凭证：~/.config/onshape/credentials.json（hello world 已建好）
// API 用量：每次跑 3-4 次调用（创建文档/Studio/上传/可选 build）
//
// 用法：
//   node scripts/onshape-upload.js                  # 创建新文档
//   node scripts/onshape-upload.js <documentId>     # 复用已有文档（更新 FS 内容）

const crypto = require('crypto');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const credsPath = path.join(process.env.HOME, '.config', 'onshape', 'credentials.json');
const creds     = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const HOST      = (creds.base_url || 'https://cad.onshape.com').replace(/^https:\/\//, '');

const FS_PATH = path.join(__dirname, '..', 'onshape', 'woodstock-frame.fs');
const FS_CODE = fs.readFileSync(FS_PATH, 'utf8');

// ---------- Onshape API 签名（同 hello world，修过的版本）----------
function sign(method, urlPath, query = '', contentType = 'application/json') {
  const nonce = crypto.randomBytes(16).toString('hex');                              // ≥25 字符
  const date  = new Date().toUTCString();
  const str   = [method, nonce, date, contentType, urlPath, query, ''].join('\n').toLowerCase();
  const hmac  = crypto.createHmac('sha256', creds.secret_key).update(str).digest('base64');
  return {
    'Date':          date,
    'On-Nonce':      nonce,
    'Authorization': `On ${creds.access_key}:HmacSHA256:${hmac}`,
    'Content-Type':  contentType,
    'Accept':        'application/json;charset=UTF-8;qs=0.09',
  };
}

function call(method, urlPath, query = '', body = null) {
  return new Promise((resolve, reject) => {
    const fullPath = urlPath + (query ? '?' + query : '');
    const headers  = sign(method, urlPath, query);
    const bodyStr  = body ? JSON.stringify(body) : null;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);
    const req = https.request({ hostname: HOST, port: 443, path: fullPath, method, headers }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
        } else {
          reject(new Error(`HTTP ${res.statusCode} on ${method} ${urlPath}: ${buf.slice(0, 500)}`));
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ---------- 主流程 ----------
(async () => {
  const reuseDid = process.argv[2];
  let did, wid;

  // 1. 创建或复用文档
  if (reuseDid) {
    console.log(`[1/3] 复用现有文档 ${reuseDid}`);
    const doc = await call('GET', `/api/documents/${reuseDid}`);
    did = doc.id;
    wid = doc.defaultWorkspace.id;
  } else {
    console.log(`[1/3] 创建新文档 "woodstock-roof"…`);
    const doc = await call('POST', '/api/documents', '', {
      name: 'woodstock-roof',
      isPublic: true,                   // Free 套餐必须 Public
      description: '车顶太阳能平台 · 自动从 cad/model.js 生成',
    });
    did = doc.id;
    wid = doc.defaultWorkspace.id;
    console.log(`     ✅ 文档创建: ${did}`);
  }
  console.log(`     URL: https://cad.onshape.com/documents/${did}/w/${wid}`);

  // 2. 找已有 frame-generator Feature Studio 或创建新的
  console.log(`[2/3] 查/建 Feature Studio "frame-generator"…`);
  const elements = await call('GET', `/api/documents/d/${did}/w/${wid}/elements`);
  let fsTab = (elements || []).find(e => e.elementType === 'FEATURESTUDIO' && e.name === 'frame-generator');
  if (fsTab) {
    console.log(`     ✅ 找到已有 Feature Studio: ${fsTab.id}`);
  } else {
    fsTab = await call('POST', `/api/featurestudios/d/${did}/w/${wid}`, '', {
      name: 'frame-generator',
    });
    console.log(`     ✅ 新建 Feature Studio: ${fsTab.id}`);
  }
  const eid = fsTab.id;

  // 3. 写入 FS 代码
  console.log(`[3/3] 上传 ${(FS_CODE.length / 1024).toFixed(1)} KB FS 代码…`);
  await call('POST', `/api/featurestudios/d/${did}/w/${wid}/e/${eid}`, '', {
    contents: FS_CODE,
  });
  console.log(`     ✅ FS 已写入`);

  console.log(`\n🎉 完成。打开链接看效果（应直接进 Feature Studio）：`);
  console.log(`   https://cad.onshape.com/documents/${did}/w/${wid}/e/${eid}\n`);
  console.log(`下一步：`);
  console.log(`   - 顶栏 ← 回 Part Studio (Tab 1)`);
  console.log(`   - 工具栏右侧最末点 "Woodstock Frame" → 勾选 → ✓ → 36 个 Part 一次性生成`);
  console.log(`   - 改了 model.js？重跑：node scripts/onshape-upload.js ${did}`);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
