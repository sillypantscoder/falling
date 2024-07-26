from wslib import WSServer, Client
import json
import typing
import random

class Card:
	def canPlay(self, playerFrom: "Player", playerTo: "Player") -> bool:
		return False
	def play(self, playerFrom: "Player", playerTo: "Player"):
		pass
	@staticmethod
	def getID() -> str:
		raise Exception("Error! abstract methods don't exist in python :(")

class RiderCard(Card):
	def canPlay(self, playerFrom: "Player", playerTo: "Player"):
		return playerTo.rider == None
	def play(self, playerFrom: "Player", playerTo: "Player"):
		playerTo.rider = {
			"rider": self,
			"extras": []
		}
	def deal(self, player: "Player", amount: int):
		for _ in range(amount):
			[player.game.deal(pile) for pile in player.piles]

class HitCard(RiderCard):
	def deal(self, player: "Player", amount: int):
		super().deal(player, amount + 1)
	@staticmethod
	def getID() -> str:
		return "hit"

class ExtraCard(Card):
	def canPlay(self, playerFrom: "Player", playerTo: "Player"):
		return playerTo.rider != None
	def play(self, playerFrom: "Player", playerTo: "Player"):
		if playerTo.rider != None:
			playerTo.rider["extras"].append(self)
	@staticmethod
	def getID() -> str:
		return "extra"

class RiderType(typing.TypedDict):
	rider: RiderCard
	extras: list[ExtraCard]

class Player:
	def __init__(self, game: "Game", name: str):
		self.game = game
		self.name = name
		self.client: Client | None = None
		self.piles: list[list[Card]] = [[
			HitCard() for _ in range(random.choice([0, 1, 2, 3]))
		]]
		self.rider: RiderType | None = None if random.choice([True, False]) else {
			"rider": HitCard(),
			"extras": [ExtraCard() for _ in range(random.choice([0, 1, 2]))]
		}
	# def getCardFromPile(self, pileIndex: int, expectedCardName: str):
	# 	if pileIndex < 0 or pileIndex >= len(self.piles):
	# 		return None
	# 	if len(self.piles[pileIndex]) == 0:
	# 		# error? should never be a zero-length pile, it should have been removed as a pile
	# 		return None
	# 	topCard = self.piles[pileIndex].pop()


server: WSServer = WSServer(8774)

class Game:
	def __init__(self):
		self.players: list[Player] = [
			Player(self, f"me{i}") for i in range(10)
		]
		self.deck = []
		self.populateDeck()
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
	def onConnect(self, c: Client):
		# Send game state
		for p in self.players:
			c.sendMessage(json.dumps({
				"type": "CreatePlayer",
				"name": p.name,
				"piles": [[card.getID() for card in pile] for pile in p.piles],
				"rider": { "rider": p.rider["rider"].getID(), "extras": [c.getID() for c in p.rider["extras"]] } if p.rider != None else None
			}))
	def onDisconnect(self, c: Client):
		p = self.findPlayerFromClient(c)
		if p:
			p.client = None
			for others in self.players:
				if others.client:
					others.client.sendMessage(json.dumps({
						"type": "Disconnected",
						"name": p.name,
					}))
	def getPlayerFromTarget(self, target: str):
		for p in self.players:
			if p.name == target:
				return p
		return None
	def onMessage(self, c: Client, message: str):
		msg = json.loads(message)
		match msg["type"]:
			case None:
				c.sendMessage("ERROR: no message type")
			case "PlayCard":
				fromPlayer = self.findPlayerFromClient(c)
				if not fromPlayer:
					c.sendMessage(f'ERROR: invalid source player')
					return
				target = msg["target"]
				toPlayer = self.getPlayerFromTarget(target)
				if toPlayer is None:
					c.sendMessage(f'ERROR: invalid target player "{target}"')
					return
				self.playCard(fromPlayer, toPlayer, msg["pile"], msg["card"])
			case _:
				c.sendMessage(f'ERROR: unknown message type "{msg["type"]}"')
		# c.sendMessage("sorry, what was that?")
		# c.disconnect()
	def deal(self, pile: list[Card]):
		if len(self.deck) == 0:
			pass
			# pile.append(GroundCard()) # HAHHAA
		else:
			pile.append(self.deck.pop())
	def playCard(self, fromPlayer: Player, toPlayer: Player, pileIndex: int, cardName: str):
		if fromPlayer.piles:
			pass

g = Game()

server.events_on_connect.append(g.onConnect)
server.events_on_disconnect.append(g.onDisconnect)
server.events_on_message.append(g.onMessage)
server.run()
