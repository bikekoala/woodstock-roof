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

  // 2. 列 Part Studio 1 里的 Part 数量（确认 FS 生成成功）
  console.log(`[2/4] 检查 Part Studio 里的 Part 数量…`);
  const parts = await call('GET', `/api/parts/d/${did}/w/${wid}/e/${partStudio.id}`);
  console.log(`     发现 ${parts.length} 个 Part（应该 36 个）`);
  if (parts.length === 0) {
    console.error(`     ❌ Part Studio 是空的。先在 Onshape UI 里跑 Custom Feature 生成 Part。`);
    process.exit(1);
  }

  // 3. 把 Part Studio 整体 Insert 到 Assembly（一个 instance = 一个零件）
  //    Onshape Assembly API: POST /api/assemblies/d/{did}/w/{wid}/e/{aid}/instances
  //    Body: { documentId, elementId, isAssembly: false, partId, isWholePartStudio: false }
  console.log(`[3/4] 把 ${parts.length} 个 Part 逐个 Insert 到 Assembly…`);
  let inserted = 0;
  for (const part of parts) {
    try {
      await call('POST', `/api/assemblies/d/${did}/w/${wid}/e/${assembly.id}/instances`, '', {
        documentId: did,
        elementId:  partStudio.id,
        partId:     part.partId,
        isAssembly: false,
        isWholePartStudio: false,
      });
      inserted++;
      process.stdout.write(`\r     ${inserted}/${parts.length} ${part.name}`.padEnd(80, ' '));
    } catch (e) {
      console.log(`\n     ⚠️ 跳过 "${part.name}": ${e.message.slice(0, 100)}`);
    }
  }
  console.log(`\n     ✅ ${inserted}/${parts.length} Insert 成功`);

  // 4. 给 URL 让车主直接打开 Assembly
  console.log(`[4/4] 完成。`);
  console.log(`\n🎉 Assembly 1 已装配。打开链接：`);
  console.log(`   https://cad.onshape.com/documents/${did}/w/${wid}/e/${assembly.id}\n`);
  console.log(`下一步（手动 30 秒）：`);
  console.log(`   - Assembly 1 里所有 Part 已 Insert 但位置都在原点叠在一起`);
  console.log(`   - 选所有零件 (Cmd+A) → 右键 → "Fix" 把它们都按 Part Studio 的位置锁定`);
  console.log(`   - 或者继续手动加 Mate 约束（spec.md §3 Mate 表）`);
  console.log(`   - 加标准件：左侧 "+ Insert" → "Standard content" → 拖角码/螺丝`);
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });
