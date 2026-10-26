/** Bizim Hikâyemiz v19 — Cloudflare Worker, ücretsiz planla uyumlu.
 * Apps Script URL'sini aşağıdaki sabite yazabilirsin. Gmail adresi veya UID ekleme.
 * Firebase token'ı sadece Apps Script'e iletilir; Worker kayıt tutmaz.
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzYJNt4r2r6uF33mNjCzB-YRsJrCiB-msA0Mmauh--YDykTumsnFDWq1QxJl9dEXc1N/exec';
const KIND = 'bizim-hikayemiz-mail-v19';
function allowedOrigin(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.protocol === 'https:' && (u.hostname.endsWith('.github.io') || u.hostname.endsWith('.pages.dev')) ||
      u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname);
  } catch { return false; }
}
function json(data, status, origin) {
  const headers = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if (allowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  return new Response(JSON.stringify(data), {status, headers});
}
export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    if (!allowedOrigin(origin)) return json({ok:false,message:'İzin verilmeyen kaynak.'},403,origin);
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{
      'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'3600','Vary':'Origin'
    }});
    if (request.method !== 'POST') return json({ok:false,message:'Yalnızca POST desteklenir.'},405,origin);
    let data;
    try {
      if (Number(request.headers.get('Content-Length') || 0) > 12000) throw Error('Çok büyük istek.');
      const raw = await request.text();
      if (raw.length > 12000) throw Error('Çok büyük istek.');
      data = JSON.parse(raw);
      if (!data || typeof data.idToken !== 'string' || data.idToken.length > 8000 ||
          typeof data.requestId !== 'string' || !/^[-a-zA-Z0-9_.]{8,120}$/.test(data.requestId))
        throw Error('Geçersiz istek.');
    } catch { return json({kind:KIND,requestId:'',ok:false,message:'Geçersiz istek.'},400,origin); }
    const body = new URLSearchParams({idToken:data.idToken,requestId:data.requestId});
    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body:body.toString(),redirect:'follow'
      });
      const content = await response.text();
      let result;
      try { result = JSON.parse(content); } catch {
        return json({kind:KIND,requestId:data.requestId,ok:false,
          message:'Apps Script JSON yanıtı alınamadı. Dağıtımı yeni sürüme yükselt.'},502,origin);
      }
      if (result.kind !== KIND || result.requestId !== data.requestId || typeof result.ok !== 'boolean')
        return json({kind:KIND,requestId:data.requestId,ok:false,message:'Beklenmeyen sunucu yanıtı.'},502,origin);
      return json(result,200,origin);
    } catch {
      return json({kind:KIND,requestId:data.requestId,ok:false,
        message:'Apps Script yanıtına ulaşılamadı. Gönderilmiş olabilir; tekrar basmadan önce gelen kutusunu kontrol et.'},502,origin);
    }
  }
};
