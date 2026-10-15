"""Servidor chico para recibir capturas del canvas del navegador y guardarlas en disco.
El juego corre en 127.0.0.1:8788; esto escucha en 127.0.0.1:8790 y acepta POST /save?name=x.png
"""
import os
import http.server

OUT = "/tmp/ns-shots"


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        name = os.path.basename(self.path.split("name=")[-1]) or "shot.png"
        if not name.endswith(".png"):
            name += ".png"
        n = int(self.headers.get("Content-Length") or 0)
        data = self.rfile.read(n) if n else b""
        os.makedirs(OUT, exist_ok=True)
        path = os.path.join(OUT, name)
        with open(path, "wb") as f:
            f.write(data)
        print("guardado", path, len(data), "bytes", flush=True)
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    http.server.HTTPServer(("127.0.0.1", 8790), Handler).serve_forever()
