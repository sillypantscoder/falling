from wslib import WSServer, Client

class PlayerData:
	def __init__(self):
		self.name = "joebob"
		self.greeting = "hi"

server: WSServer[PlayerData] = WSServer(8774)

class Game:
	def playerJoins(self, c: Client[PlayerData]):
		c.sendMessage("hello")
		c.sendMessage(c.data.name if c.data != None else "noname")
	def playerLeaves(self, c: Client[PlayerData]):
		c.sendMessage("Noooo come back!")
	def playerMessage(self, c: Client[PlayerData], message: str):
		c.sendMessage("sorry, what was that?")

def connect(c: Client[PlayerData]):
	c.sendMessage(c.data.name if c.data != None else "noname")
	print(f"new connection with id {c.id}")

def disconnect(c: Client[PlayerData]):
	pass

def message(c: Client[PlayerData], message: str):
	[x.sendMessage(f"message from {c.id}: {message}") for x in server.clients]

g = Game()

server.events_on_connect.append(g.playerJoins)
server.events_on_disconnect.append(g.playerLeaves)
server.events_on_message.append(g.playerMessage)
server.run()
