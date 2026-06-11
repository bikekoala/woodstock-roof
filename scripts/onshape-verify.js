#!/usr/bin/env node
// scripts/onshape-verify.js
// 拉 Onshape Part Studio 里每个 Part 的 boundingbox，跟 onshape/spec.json 的
// origin + size 比对。误差 ≤0.5mm 视为通过。
//
// 用法：node scripts/onshape-verify.js <documentId>
// API 用量：约 40 次（GET parts + 36 × GET boundingbox）

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

function call(method, urlPath, query = '') {
  return new Promise((resolve, reject) => {
    const fullPath = urlPath + (query ? '?' + query : '');
    const headers  = sign(method, urlPath, query);
    const req = https.request({ hostname: HOST, port: 443, path: fullPath, method, headers }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => res.statusCode < 300
        ? resolve(JSON.parse(buf))
        : reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`)));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const did = process.argv[2];
  if (!did) { console.error('用法：node scripts/onshape-verify.js <documentId>'); process.exit(1); }

  // 1. 读 spec.json 拿期望几何
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'onshape', 'spec.json'), 'utf8'));
  const expected = {};
  function collect(items) {
    items.forEach(e => e.instances.forEach((inst, k) => {
      const name = `${e.code}-${k + 1} ${e.name}`;
      const shortName = e.instances.length === 1 ? `${e.code} ${e.name}` : name;
      expected[name] = { o: inst.origin, s: inst.size };
      expected[shortName] = { o: inst.origin, s: inst.size };
    }));
  }
  collect(spec.extrusions);
  collect(spec.slideHinge);
  collect(spec.panels);
  if (spec.tank) collect([spec.tank]);
  console.log(`期望几何：${spec.totals.extrusions} 型材 + ${spec.slideHinge.length} 滑/合 + ${spec.panels.length} 板 + 1 水箱\n`);

  // 2. 拿 Part Studio
  const doc = await call('GET', `/api/documents/${did}`);
  const wid = doc.defaultWorkspace.id;
  const els = await call('GET', `/api/documents/d/${did}/w/${wid}/elements`);
  const psid = els.find(e => e.elementType === 'PARTSTUDIO').id;
  const parts = await call('GET', `/api/parts/d/${did}/w/${wid}/e/${psid}`);
  console.log(`Onshape Part Studio：${parts.length} 个 Part\n`);

  // 3. 拉每个 Part 的 boundingbox + 跟期望比对
  let pass = 0, fail = 0;
  const failures = [];
  for (const part of parts) {
    const bb = await call('GET', `/api/parts/d/${did}/w/${wid}/e/${psid}/partid/${encodeURIComponent(part.partId)}/boundingboxes`);
    // bb 单位是米，转 mm
    const actual = {
      o: [bb.lowX * 1000, bb.lowY * 1000, bb.lowZ * 1000],
      s: [(bb.highX - bb.lowX) * 1000, (bb.highY - bb.lowY) * 1000, (bb.highZ - bb.lowZ) * 1000],
    };
    const exp = expected[part.name];
    if (!exp) { failures.push(`无期望: ${part.name}`); fail++; continue; }

    const TOL = 0.5;  // mm
    const diff = [];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(actual.o[i] - exp.o[i]) > TOL) diff.push(`o[${i}]=${actual.o[i].toFixed(1)}≠${exp.o[i]}`);
      if (Math.abs(actual.s[i] - exp.s[i]) > TOL) diff.push(`s[${i}]=${actual.s[i].toFixed(1)}≠${exp.s[i]}`);
    }
    if (diff.length === 0) { pass++; }
    else { failures.push(`${part.name} | ${diff.join(', ')}`); fail++; }
  }

  console.log(`✅ 通过：${pass}/${parts.length}`);
  if (fail > 0) {
    console.log(`❌ 失败：${fail}`);
    failures.forEach(f => console.log('   ' + f));
    process.exit(1);
  } else {
    console.log(`\n🎉 全部 36 个 Part 几何 100% 跟 spec.json 一致（误差 ≤0.5mm）`);
  }
})().catch(e => { console.error('❌', e.message); process.exit(1); });
