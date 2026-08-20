// Minimal Node-`http.ServerResponse`-shaped object (writeHead/setHeader/end)
// that route handlers already know how to use, backed by a real Web Response
// under the hood. This lets the same route handler code run unchanged behind
// both a plain Node http.Server (server.js) and a Netlify Function, which must
// return a Response object rather than writing to a live socket.
export class FakeRes {
  constructor() {
    this.statusCode = 200;
    this.headersList = new Headers();
    this._body = '';
    this._ended = false;
  }

  writeHead(status, headers) {
    this.statusCode = status;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        this.setHeader(key, value);
      }
    }
  }

  setHeader(name, value) {
    if (name.toLowerCase() === 'set-cookie') {
      this.headersList.append(name, value);
    } else {
      this.headersList.set(name, value);
    }
  }

  end(body) {
    this._body = body ?? '';
    this._ended = true;
  }

  get headersSent() {
    return this._ended;
  }

  toResponse() {
    return new Response(this._body, { status: this.statusCode, headers: this.headersList });
  }
}
