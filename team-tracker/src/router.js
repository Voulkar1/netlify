export function createRouter() {
  const routes = { GET: [], POST: [], PATCH: [], DELETE: [], PUT: [] };

  function compile(pattern) {
    const paramNames = [];
    const regexStr = pattern
      .split('/')
      .map((seg) => {
        if (seg.startsWith(':')) {
          paramNames.push(seg.slice(1));
          return '([^/]+)';
        }
        return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('/');
    return { regex: new RegExp(`^${regexStr}$`), paramNames };
  }

  function add(method, pattern, handler) {
    const { regex, paramNames } = compile(pattern);
    routes[method].push({ regex, paramNames, handler });
  }

  return {
    get: (p, h) => add('GET', p, h),
    post: (p, h) => add('POST', p, h),
    patch: (p, h) => add('PATCH', p, h),
    delete: (p, h) => add('DELETE', p, h),
    put: (p, h) => add('PUT', p, h),
    async handle(req, res, pathname, ctx) {
      const list = routes[req.method] || [];
      for (const r of list) {
        const m = r.regex.exec(pathname);
        if (m) {
          const params = {};
          r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])));
          await r.handler(req, res, { ...ctx, params });
          return true;
        }
      }
      return false;
    },
  };
}

// Reads the full request body as text. Works with both a Web Fetch API
// Request (Netlify Functions) and our FakeRes-paired plain req objects — both
// expose an async .text() method.
export async function readBody(req) {
  if (typeof req.text === 'function') {
    return (await req.text()) || '';
  }
  // Fallback: Node http.IncomingMessage stream (used if this app is ever run
  // behind a raw http.Server with a different adapter).
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function readForm(req) {
  const raw = await readBody(req);
  return Object.fromEntries(new URLSearchParams(raw));
}

export function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

export function sendHtml(res, status, html) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}
