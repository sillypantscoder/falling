from wslib import WSServer, Client
import json
import typing
import random
import threading
import time

class Card:
	def canPlay(self, playerFrom: "Player", playerTo: "Player") -> bool:
		return False
	def play(self, playerFrom: "Player", pileIndex: int, playerTo: "Player"):
		pass
	@staticmethod
	def getID() -> str:
		raise Exception("Error! abstract methods don't exist in python :(")

class RiderCard(Card):
	def canPlay(self, playerFrom: "Player", playerTo: "Player"):
		return playerTo.rider == None
	def play(self, playerFrom: "Player", pileIndex: int, playerTo: "Player"):
		playerTo.rider = {
			"rider": self,
			"extras": []
		}
		playerTo.game.broadcast(json.dumps({
			"type": "PlayRider",
			"playerFrom": playerFrom.name,
			"fromPile": pileIndex,
			"playerTo": playerTo.name
		}))
	def deal(self, player: "Player", amount: int):
		for _ in range(amount):
			[player.game.dealCard(player, pileIndex) for pileIndex in range(len(player.piles))]
		player.game.broadcast(json.dumps({
			"type": "RemoveRider",
			"player": player.name
		}))
		player.rider = None

class HitCard(RiderCard):
	def deal(self, player: "Player", amount: int):
		super().deal(player, amount + 1)
	@staticmethod
	def getID() -> str:
		return "hit"

class ExtraCard(Card):
	def canPlay(self, playerFrom: "Player", playerTo: "Player"):
		return playerTo.rider != None
	def play(self, playerFrom: "Player", pileIndex: int, playerTo: "Player"):
		if playerTo.rider != None:
			playerTo.rider["extras"].append(self)
			playerTo.game.broadcast(json.dumps({
				"type": "PlayRider",
				"playerFrom": playerFrom.name,
				"fromPile": pileIndex,
				"playerTo": playerTo.name
			}))
	@staticmethod
	def getID() -> str:
		return "extra"

class GroundCard(Card):
	@staticmethod
	def getID() -> str:
		return "ground"

class RiderType(typing.TypedDict):
	rider: RiderCard
	extras: list[ExtraCard]

class Player:
	def __init__(self, game: "Game", name: str):
		self.game = game
		self.name = name
		self.client: Client | None = None
		self.piles: list[list[Card]] = [
			[
				random.choice([HitCard(), ExtraCard()])
				for _ in range(random.choice([0, 1, 2, 3]))
			]
			for _ in range(random.choice([1, 2]))
		]
		self.rider: RiderType | None = None if random.choice([True, False]) else {
			"rider": HitCard(),
			"extras": [ExtraCard() for _ in range(random.choice([0, 0, 0, 0, 1, 2]))]
		}
	def getCreationMessage(self):
		return json.dumps({
			"type": "CreatePlayer",
			"name": self.name,
			"piles": [[card.getID() for card in pile] for pile in self.piles],
			"rider": { "rider": self.rider["rider"].getID(), "extras": [c.getID() for c in self.rider["extras"]] } if self.rider != None else None
		})

server: WSServer = WSServer(8774)

class Game:
	def __init__(self):
		self.players: list[Player] = [
			Player(self, f"me{i + 1}") for i in range(6)
		]
		self.deck = []
		self.populateDeck()
		self.turn = 0
	def populateDeck(self):
		self.deck = [
			*[HitCard() for _ in range(50)],
			*[ExtraCard() for _ in range(30)]
		]
		random.shuffle(self.deck)
	def findPlayerFromClient(self, c: Client):
		for p in self.players:
			if p.client == c:
				return p
	def findPlayerFromName(self, c: str):
		for p in self.players:
			if p.name == c:
				return p
	def broadcast(self, msg: str):
		# Send game state
		for p in self.players:
			if p.client != None:
				p.client.sendMessage(msg)
	def onConnect(self, c: Client):
		# Send game state
		for p in self.players:
			c.sendMessage(p.getCreationMessage())
	def onDisconnect(self, c: Client):
		p = self.findPlayerFromClient(c)
		if p:
			p.client = None
	def getPlayerFromTarget(self, target: str):
		for p in self.players:
			if p.name == target:
				return p
		return None
	def onMessage(self, c: Client, message: str):
		msg = json.loads(message)
		if msg["type"] == "Login":
			p = self.findPlayerFromName(msg["name"])
			if p:
				if p.client != None:
					print(f'ERROR: client {c.id} attempted to connect as {p.name} (already taken by client {p.client.id})')
					c.disconnect()
				else:
					# Login
					p.client = c
			else:
				# Create a new player
				newPlayer = Player(self, msg["name"])
				self.players.append(newPlayer)
				self.broadcast(newPlayer.getCreationMessage())
		elif msg["type"] == "PlayCard":
			playerFrom = self.findPlayerFromClient(c)
			if playerFrom == None:
				print(f'ERROR: client {c.id} cannot play a card as they are not logged in')
				return
			pileIndex: int = msg["pileIndex"]
			playerTo = self.findPlayerFromName(msg["target"])
			if playerTo == None:
				print(f'ERROR: client {c.id} cannot play a card to unknown player {msg["target"]}')
				return
			# Play the card!
			card = playerFrom.piles[pileIndex][-1]
			if not card.canPlay(playerFrom, playerTo):
				c.sendMessage(json.dumps({
					"type": "RevertCard",
					"pile": pileIndex
				}))
				return
			playerFrom.piles[pileIndex].remove(card)
			card.play(playerFrom, pileIndex, playerTo)
		else:
			print(f'ERROR: unknown message type "{msg["type"]}" recieved from client {c.id}')
			c.disconnect()
	def dealCards(self):
		extraTurns = 100
		while extraTurns > 0:
			if len(self.deck) == 0:
				extraTurns -= 1
			# Do turn
			turn = self.players[self.turn]
			if turn.rider == None:
				for pileIndex in range(len(turn.piles)):
					self.dealCard(turn, pileIndex)
			else:
				amount = len(turn.rider["extras"]) + 1
				turn.rider["rider"].deal(turn, amount)
			# Continue
			self.turn += 1
			if self.turn >= len(self.players):
				self.turn = 0
	def dealCard(self, player: Player, pileIndex: int):
		card = GroundCard()
		if len(self.deck) > 0:
			card = self.deck.pop()
		elif len(player.piles[pileIndex]) == 0:
			pass
		elif isinstance(player.piles[pileIndex][-1], GroundCard):
			return
		player.piles[pileIndex].append(card)
		self.broadcast(json.dumps({
			"type": "DealCard",
			"player": player.name,
			"pile": pileIndex,
			"card": card.getID()
		}))
		time.sleep(0.5)

g = Game()
threading.Thread(target=g.dealCards, name="dealer", args=()).start()

server.events_on_connect.append(g.onConnect)
server.events_on_disconnect.append(g.onDisconnect)
server.events_on_message.append(g.onMessage)
server.run()

# stop the dealing thread
g.deck = []
print()
