"""Sirve el juego y guarda capturas del canvas en el MISMO origen (127.0.0.1:8788).
Así la CSP del juego (`connect-src 'self'`) no bloquea el POST y no hay que debilitarla.
"""
import os
import http.server

# Rutas relativas al directorio desde donde se lanza (la raíz del proyecto).
ROOT = os.environ.get("SHOT_ROOT", "docs")
OUT = os.environ.get("SHOT_OUT", "shots")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        name = os.path.basename(self.path.split("name=")[-1]) or "shot.png"
        if not name.endswith(".png"):
            name += ".png"
        n = int(self.headers.get("Content-Length") or 0)
        data = self.rfile.read(n) if n else b""
        os.makedirs(OUT, exist_ok=True)
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(data)
        print("guardado", name, len(data), "bytes", flush=True)
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", 8788), Handler).serve_forever()
