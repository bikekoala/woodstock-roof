#!/usr/bin/env node
// scripts/onshape-assemble.js
// Phase 3：把 Part Studio 1 的 36 个零件整体 Insert 到 Assembly 1
//
// 用法：node scripts/onshape-assemble.js <documentId>
// API 用量：~4 次（GET tabs/parts × 2 + POST instances + GET 状态）

const crypto = require('crypto');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const credsPath = path.join(process.env.HOME, '.config', 'onshape', 'credentials.json');
const creds     = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const HOST      = (creds.base_url || 'https://cad.onshape.com').replace(/^https:\/\//, '');

function sign(method, urlPath, query = '', contentType = 'application/json') {
  const nonce = crypto.randomBytes(16).toString('hex');
  const date  = new Date().toUTCString();
  const str   = [method, nonce, date, contentType, urlPath, query, ''].join('\n').toLowerCase();
  const hmac  = crypto.createHmac('sha256', creds.secret_key).update(str).digest('base64');
  return {
    'Date': date, 'On-Nonce': nonce,
    'Authorization': `On ${creds.access_key}:HmacSHA256:${hmac}`,
    'Content-Type': contentType,
    'Accept': 'application/json;charset=UTF-8;qs=0.09',
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

(async () => {
  const did = process.argv[2];
  if (!did) {
    console.error('用法：node scripts/onshape-assemble.js <documentId>');
    process.exit(1);
  }

  // 1. 拿文档 workspace + tab IDs
  console.log(`[1/4] 解析文档结构…`);
  const doc = await call('GET', `/api/documents/${did}`);
  const wid = doc.defaultWorkspace.id;
  const elements = await call('GET', `/api/documents/d/${did}/w/${wid}/elements`);

  const partStudio = elements.find(e => e.elementType === 'PARTSTUDIO');
  const assembly   = elements.find(e => e.elementType === 'ASSEMBLY');
  if (!partStudio || !assembly) {
    throw new Error(`Part Studio 或 Assembly 没找到（tabs: ${elements.map(e => e.name).join(', ')}）`);
  }
  console.log(`     Part Studio: ${partStudio.name} (${partStudio.id})`);
  console.log(`     Assembly:    ${assembly.name} (${assembly.id})`);

  // 2. 看 Assembly 当前有几个 instance（如果非空，先警告）
  const asmDef = await call('GET', `/api/assemblies/d/${did}/w/${wid}/e/${assembly.id}`);
  if (asmDef.rootAssembly.instances.length > 0) {
    console.error(`[2/3] ❌ Assembly 已有 ${asmDef.rootAssembly.instances.length} 个实例。`);
    console.error(`        本脚本只支持空 Assembly。请先在 Onshape UI 里全选 → 删除，或者重建文档。`);
    process.exit(1);
  }
  console.log(`[2/3] Assembly 是空的 ✓`);

  // 3. 一次 Insert 整个 Part Studio（isWholePartStudio: true）
  //    这样保留 Part Studio 的几何关系 + 只占 1 个组（避免 36 次零散 Insert 的重影坑）
  console.log(`[3/3] Insert Part Studio (whole) → Assembly…`);
  await call('POST', `/api/assemblies/d/${did}/w/${wid}/e/${assembly.id}/instances`, '', {
    documentId: did,
    elementId:  partStudio.id,
    isAssembly: false,
    isWholePartStudio: true,
  });
  const asm2 = await call('GET', `/api/assemblies/d/${did}/w/${wid}/e/${assembly.id}`);
  console.log(`     ✅ Insert 完成，现有 ${asm2.rootAssembly.instances.length} 个实例（应该 36 个，组成一组）`);

  console.log(`\n🎉 Assembly 1 已装配。打开链接：`);
  console.log(`   https://cad.onshape.com/documents/${did}/w/${wid}/e/${assembly.id}\n`);
  console.log(`下一步（在 Onshape UI 里手动）：`);
  console.log(`   - 几何位置应该已对（跟 Part Studio 1 一样）— 整组刚体已锁定`);
  console.log(`   - 加标准件：左侧 "+ Insert" → "Standard content" → 拖角码/螺丝`);
  console.log(`   - 跑干涉检查：Assembly → Interference check`);
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });
