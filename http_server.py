from http.server import BaseHTTPRequestHandler, HTTPServer
import typing
import os
import sys

hostName = "0.0.0.0"
serverPort = 8080

class URLQuery:
	def __init__(self, q: str):
		self.orig = q
		self.fields: dict[str, str] = {}
		for f in q.split("&"):
			s = f.split("=")
			if len(s) >= 2:
				self.fields[s[0]] = s[1]
	def get(self, key: str, default: str = ''):
		if key in self.fields:
			return self.fields[key]
		else:
			return default

def read_file(filename: str) -> bytes:
	"""Read a file and return the contents."""
	f = open(filename, "rb")
	t = f.read()
	f.close()
	return t

def write_file(filename: str, content: bytes):
	"""Write data to a file."""
	f = open(filename, "wb")
	f.write(content)
	f.close()

class HttpResponse(typing.TypedDict):
	"""A dict containing an HTTP response."""
	status: int
	headers: dict[str, str]
	content: str | bytes

def get(path: str, query: URLQuery) -> HttpResponse:
	if os.path.isfile("public_files" + path):
		return {
			"status": 200,
			"headers": {
				"Content-Type": {
					"html": "text/html",
					"js": "text/javascript",
					"css": "text/css",
					"svg": "image/svg+xml",
					"ico": "image/x-icon"
				}[path.split(".")[-1]]
			},
			"content": read_file("public_files" + path)
		}
	elif os.path.isdir("public_files" + path):
		return {
			"status": 200,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": read_file("public_files" + path + "index.html")
		}
	else: # 404 page
		print("404 GET " + path)
		return {
			"status": 404,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": ""
		}

def post(path: str, body: bytes) -> HttpResponse:
	bodydata = body.decode("UTF-8").split("\n")
	if path == "/":
		print("Data recieved:")
		print(bodydata)
		return {
			"status": 404,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": ""
		}
	else:
		print("404 POST " + path)
		return {
			"status": 404,
			"headers": {
				"Content-Type": "text/html"
			},
			"content": ""
		}

class MyServer(BaseHTTPRequestHandler):
	def do_GET(self):
		splitpath = self.path.split("?")
		res = get(splitpath[0], URLQuery(''.join(splitpath[1:])))
		self.send_response(res["status"])
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		c = res["content"]
		if isinstance(c, str): c = c.encode("utf-8")
		self.wfile.write(c)
	def do_POST(self):
		res = post(self.path, self.rfile.read(int(self.headers["Content-Length"])))
		self.send_response(res["status"])
		for h in res["headers"]:
			self.send_header(h, res["headers"][h])
		self.end_headers()
		c = res["content"]
		if isinstance(c, str): c = c.encode("utf-8")
		self.wfile.write(c)
	def log_message(self, _format: str, *args) -> None: # type: ignore
		return

if __name__ == "__main__":
	running = True
	webServer = HTTPServer((hostName, serverPort), MyServer)
	webServer.timeout = 1
	print(f"Server started http://{hostName}:{serverPort}")
	sys.stdout.flush()
	while running:
		try:
			webServer.handle_request()
		except KeyboardInterrupt:
			running = False
	webServer.server_close()
	print("Server stopped")
