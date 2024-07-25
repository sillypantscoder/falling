import websocket_server as ws # type: ignore
import typing

class InternalClient(typing.TypedDict):
	id: int
	handler: ws.WebSocketHandler
	address: tuple[str, int]

class Client:
	def __init__(self, internal: InternalClient, server: "WSServer"):
		self.internal = internal
		self.server = server
		self.id = internal["id"]
	def sendMessage(self, msg: str):
		self.server.server.send_message(self.internal, msg) # type: ignore

class WSServer:
	def __init__(self, port: int):
		# Setup
		self.server = ws.WebsocketServer(host="0.0.0.0", port=port)
		self.server.set_fn_new_client(lambda client, server: self.new_client(client, server)) # type: ignore
		self.server.set_fn_client_left(lambda client, server: self.client_left(client, server)) # type: ignore
		self.server.set_fn_message_received(lambda client, server, message: self.message_received(client, server, message)) # type: ignore
		# keep track of clients
		self.clients: list[Client] = []
		self.events_on_connect: list[typing.Callable[[ Client ], None]] = []
		self.events_on_message: list[typing.Callable[[ Client, str ], None]] = []
		self.events_on_disconnect: list[typing.Callable[[ Client ], None]] = []
	def run(self):
		print(f"Server started at: http://{self.server.server_address[0]}:{self.server.server_address[1]}/")
		self.server.run_forever()
	def find_client(self, client: InternalClient) -> Client:
		if client == None: # type: ignore
			raise Exception(f"Could not find client with id None")
		for c in self.clients:
			if c.internal == client:
				return c
		raise Exception(f"Could not find client with id: {client['id']}")
	def new_client(self, client: InternalClient, server: ws.WebsocketServer):
		newClient = Client(client, self)
		self.clients.append(newClient)
		[x(newClient) for x in self.events_on_connect]
	def client_left(self, client: InternalClient, server: ws.WebsocketServer):
		c = self.find_client(client)
		self.clients.remove(c)
		[x(c) for x in self.events_on_disconnect]
	def message_received(self, client: InternalClient, server: ws.WebsocketServer, message: str):
		c = self.find_client(client)
		[x(c, message) for x in self.events_on_message]



if __name__ == "__main__":
	server = WSServer(8774)
	def connect(c: Client):
		print(f"new connection with id {c.id}")
		# [x.sendMessage(f"hello: {c.id}") for x in server.clients]
	def disconnect(c: Client):
		pass
		# [x.sendMessage(f"bye: {c.id}") for x in server.clients]
	def message(c: Client, message: str):
		[x.sendMessage(f"message from {c.id}: {message}") for x in server.clients]
	server.events_on_connect.append(connect)
	server.events_on_disconnect.append(disconnect)
	server.events_on_message.append(message)
	server.run()
