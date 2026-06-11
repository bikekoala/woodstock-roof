#!/usr/bin/env node
// scripts/onshape-api-hello.js
// Onshape REST API hello world：验证凭证 + 列账户文档
//
// 凭证位置：~/.config/onshape/credentials.json（chmod 600，不在仓库内）
// API 文档：https://onshape-public.github.io/docs/api-intro/
// 限额：免费版 2500 requests/月（本脚本一次跑用 2 次：sessioninfo + documents 列表）
//
// 用法：node scripts/onshape-api-hello.js

const crypto = require('crypto');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');

const credsPath = path.join(process.env.HOME, '.config', 'onshape', 'credentials.json');
if (!fs.existsSync(credsPath)) {
  console.error(`❌ 凭证未找到：${credsPath}`);
  console.error(`   先创建该文件，格式见 onshape/README.md`);
  process.exit(1);
}
const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const HOST = (creds.base_url || 'https://cad.onshape.com').replace(/^https:\/\//, '');

// Onshape API 签名 — HMAC-SHA256
// 规范：https://onshape-public.github.io/docs/api-intro/#sign
function sign(method, urlPath, query = '', contentType = 'application/json') {
  const nonce = crypto.randomBytes(16).toString('hex');          // 32 字符（Onshape 要求 ≥25）
  const date  = new Date().toUTCString();
  // Onshape 规范：string-to-sign 末尾要带一个 \n（参考官方 Python client）
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

function call(method, urlPath, query = '') {
  return new Promise((resolve, reject) => {
    const fullPath = urlPath + (query ? '?' + query : '');
    const headers  = sign(method, urlPath, query);
    const req = https.request({ hostname: HOST, port: 443, path: fullPath, method, headers }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body)); } catch { resolve(body); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    console.log(`[Onshape API Hello] base = ${HOST}\n`);

    // 1. 拉账户信息（最便宜的端点）
    const me = await call('GET', '/api/users/sessioninfo');
    console.log(`✅ 认证成功`);
    console.log(`   套餐：${me.planGroup || '?'}${me.companyPlan ? ' (Company)' : ''}`);
    console.log(`   角色：${(me.roles || []).join(', ') || '-'}`);
    console.log(`   类型：${me.isGuest ? 'Guest' : me.isLight ? 'Light' : '正式账号'}`);
    console.log(``);

    // 2. 列前 5 个文档（验证文档操作权限）
    const docs = await call('GET', '/api/documents', 'limit=5&sortColumn=createdAt&sortOrder=desc');
    console.log(`✅ 文档列表（最近 ${docs.items?.length || 0} 个，按创建时间倒序）：`);
    (docs.items || []).forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.name} (${d.id})  ${d.public ? '🌐 Public' : '🔒 Private'}`);
    });
    console.log(``);
    console.log(`🎉 API 通路工作正常。本次共 2 次请求（账单 2500/月）。`);
  } catch (e) {
    console.error(`❌ 请求失败：${e.message}`);
    process.exit(1);
  }
})();
