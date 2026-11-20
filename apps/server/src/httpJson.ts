import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
export const proxyAgent = proxy ? new HttpsProxyAgent(proxy) : undefined;

/** GET/POST JSON che rispetta il proxy (il fetch nativo di Node lo ignora). */
export function requestJson<T>(url: string, body?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = https.request(url, {
      method: payload ? 'POST' : 'GET', agent: proxyAgent,
      headers: payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {},
    }, (res) => {
      let text = '';
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(text) as T); } catch { reject(new Error('risposta non JSON')); }
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}
