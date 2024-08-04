from wslib import WSServer, Client
import json
import typing
import random
import threading
import time
import datetime

SECONDS_PER_CARD = 1.0

class Card:
	def canPlay(self, playerFrom: "Player", playerTo: "Player") -> str | typing.Literal[True]:
		"""Find whether it is allowed to play this card on another person. Return True if the play is valid, or a reason otherwise."""
		return "You can't play this card!"
	def play(self, playerFrom: "Player", pileIndex: int, cardIndex: int, playerTo: "Player"):
		pass
	@staticmethod
	def getID() -> str:
		raise Exception("Error! abstract methods don't exist in python :(")

class RiderCard(Card):
	def canPlay(self, playerFrom: "Player", playerTo: "Player"):
		if playerTo.rider == None:
			return True
		else:
			return f"<b>{playerTo.name}</b> already has a \"<b>{playerTo.rider['rider'].getID()}</b>\" card active!"
	def play(self, playerFrom: "Player", pileIndex: int, cardIndex: int, playerTo: "Player"):
		playerTo.rider = {
			"rider": self,
			"extras": []
		}
		playerTo.game.broadcast(json.dumps({
			"type": "PlayRider",
			"playerFrom": playerFrom.name,
			"fromPile": pileIndex,
			"cardIndex": cardIndex,
			"playerTo": playerTo.name
		}))
	def deal(self, player: "Player", amount: int):
		# Deal
		for _ in range(amount):
			[player.game.dealCard(player, pileIndex) for pileIndex in range(len(player.piles))]
		# Remove card
		player.game.broadcast(json.dumps({
			"type": "RemoveRider",
			"player": player.name,
			"justOneExtra": False
		}))
		player.rider = None

class HitCard(RiderCard):
	def deal(self, player: "Player", amount: int):
		super().deal(player, amount + 1)
	@staticmethod
	def getID() -> str:
		return "hit"

class SkipCard(RiderCard):
	def deal(self, player: "Player", amount: int):
		if amount == 1:
			# Remove Skip card
			player.game.broadcast(json.dumps({
				"type": "RemoveRider",
				"player": player.name,
				"justOneExtra": False
			}))
			player.rider = None
		elif player.rider != None:
			# Remove just an extra
			player.game.broadcast(json.dumps({
				"type": "RemoveRider",
				"player": player.name,
				"justOneExtra": True
			}))
			player.rider["extras"].pop()
		time.sleep(SECONDS_PER_CARD)
	@staticmethod
	def getID() -> str:
		return "skip"

class SplitCard(RiderCard):
	def deal(self, player: "Player", amount: int):
		for _ in range(amount):
			player.piles.append([])
			player.game.broadcast(json.dumps({
				"type": "NewPile",
				"player": player.name
			}))
		super().deal(player, 1)
	@staticmethod
	def getID() -> str:
		return "split"

class ExtraCard(Card):
	def canPlay(self, playerFrom: "Player", playerTo: "Player"):
		if playerTo.rider != None:
			return True
		else:
			return f"<b>{playerTo.name}</b> doesn't have a card active!"
	def play(self, playerFrom: "Player", pileIndex: int, cardIndex: int, playerTo: "Player"):
		if playerTo.rider != None:
			playerTo.rider["extras"].append(self)
			playerTo.game.broadcast(json.dumps({
				"type": "PlayRider",
				"playerFrom": playerFrom.name,
				"fromPile": pileIndex,
				"cardIndex": cardIndex,
				"playerTo": playerTo.name
			}))
	@staticmethod
	def getID() -> str:
		return "extra"

class StopCard(Card):
	def canPlay(self, playerFrom: "Player", playerTo: "Player"):
		if playerTo.rider != None:
			return True
		else:
			return f"<b>{playerTo.name}</b> doesn't have a card active!"
	def play(self, playerFrom: "Player", pileIndex: int, cardIndex: int, playerTo: "Player"):
		playerTo.game.broadcast(json.dumps({
			"type": "PlayAndDiscard",
			"playerFrom": playerFrom.name,
			"fromPile": pileIndex,
			"cardIndex": cardIndex,
			"playerTo": playerTo.name
		}))
		playerTo.game.broadcast(json.dumps({
			"type": "RemoveRider",
			"player": playerTo.name,
			"justOneExtra": False
		}))
		playerTo.rider = None
	@staticmethod
	def getID() -> str:
		return "stop"

class GroundCard(Card):
	@staticmethod
	def getID() -> str:
		return "ground"

class RiderType(typing.TypedDict):
	rider: RiderCard
	extras: list[ExtraCard]

class HandType(typing.TypedDict):
	pickupTime: datetime.datetime
	pileIndex: int
	cardIndex: int

class Player:
	def __init__(self, game: "Game", name: str):
		self.game = game
		self.name = name
		self.client: Client | None = None
		self.piles: list[list[Card]] = [[]]
		self.rider: RiderType | None = None
		self.hand: HandType | None = None
		self.ready: bool = False
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
		self.players: list[Player] = []
		self.deck = []
		self.turn = 0
		self.started = False
		self.running = True
		self.dealingThread = threading.Thread(target=self.runThread, name="dealer", args=())
		self.dealingThread.start()
	def populateDeck(self):
		self.deck = [
			*[HitCard() for _ in range(24)],
			*[SkipCard() for _ in range(24)],
			*[SplitCard() for _ in range(14)],
			*[ExtraCard() for _ in range(10)],
			*[StopCard() for _ in range(10)]
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
		for p in self.players:
			if p.client != None:
				p.client.sendMessage(msg)
	def onConnect(self, c: Client):
		# Send game state
		for p in self.players:
			c.sendMessage(p.getCreationMessage())
		if self.started:
			c.sendMessage(json.dumps({
				"type": "ReadyUpdate",
				"data": [False for _ in self.players],
				"showBtn": False
			}))
		else:
			c.sendMessage(json.dumps({
				"type": "ReadyUpdate",
				"data": [p.ready for p in self.players],
				"showBtn": False
			}))
	def onDisconnect(self, c: Client):
		p = self.findPlayerFromClient(c)
		if p:
			p.client = None
			if self.started == False:
				self.players.remove(p)
				self.broadcast(json.dumps({
					"type": "RemovePlayer",
					"name": p.name,
					"onlyData": False
				}))
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
				if self.started:
					return
				# Create a new player
				newPlayer = Player(self, msg["name"])
				self.players.append(newPlayer)
				newPlayer.client = c
				self.broadcast(newPlayer.getCreationMessage())
				c.sendMessage(json.dumps({
					"type": "ReadyUpdate",
					"data": [p.ready for p in self.players],
					"showBtn": True
				}))
		elif msg["type"] == "GrabCard":
			playerFrom = self.findPlayerFromClient(c)
			# Ensure player is logged in
			if playerFrom == None:
				print(f'ERROR: client {c.id} cannot play a card as they are not logged in')
				return
			# Find the selected card
			pileIndex: int = msg["pileIndex"]
			pile = playerFrom.piles[pileIndex]
			# Register the card
			playerFrom.hand = {
				"pickupTime": datetime.datetime.now(),
				"pileIndex": pileIndex,
				"cardIndex": len(pile) - (2 if msg["slide"] else 1)
			}
		elif msg["type"] == "PlayCard":
			playerFrom = self.findPlayerFromClient(c)
			# Ensure player is logged in
			if playerFrom == None:
				print(f'ERROR: client {c.id} cannot play a card as they are not logged in')
				return
			# Ensure the player has picked up a card
			if playerFrom.hand == None:
				print(f'ERROR: client {c.id} cannot play a card without picking up a card first')
				return
			# Ensure the player has not been holding a card for too long
			if (datetime.datetime.now() - playerFrom.hand["pickupTime"]).total_seconds() > 1.5:
				return
			# Ensure there is a valid target player
			if msg["target"] == None:
				return
			playerTo = self.findPlayerFromName(msg["target"])
			if playerTo == None:
				print(f'ERROR: client {c.id} cannot play a card to unknown player {msg["target"]}')
				return
			# Find the selected card
			pileIndex = playerFrom.hand["pileIndex"]
			pile = playerFrom.piles[pileIndex]
			# Determine whether we can play the card
			card = pile[playerFrom.hand["cardIndex"]]
			canPlay = card.canPlay(playerFrom, playerTo)
			if canPlay != True:
				c.sendMessage(json.dumps({
					"type": "Message",
					"msg": canPlay
				}))
				return
			# Play the card!
			pile.remove(card)
			card.play(playerFrom, pileIndex, playerFrom.hand["cardIndex"], playerTo)
			playerFrom.hand = None
			# Remove the pile if necessary
			if len(pile) == 0:
				playerFrom.piles.pop(pileIndex)
				self.broadcast(json.dumps({
					"type": "RemovePile",
					"player": playerFrom.name,
					"pile": pileIndex
				}))
		elif msg["type"] == "Ready":
			if self.started == False:
				p = self.findPlayerFromClient(c)
				if p == None:
					return
				p.ready = True
				self.broadcast(json.dumps({
					"type": "ReadyUpdate",
					"data": [p.ready for p in self.players],
					"showBtn": True
				}))
		else:
			print(f'ERROR: unknown message type "{msg["type"]}" recieved from client {c.id}')
			c.disconnect()
	def runThread(self):
		while self.running:
			self.playOneRoundFromThread()
	def playOneRoundFromThread(self):
		self.started = False
		# Notify players that game is starting
		for p in self.players:
			p.ready = False
		self.broadcast(json.dumps({
			"type": "ReadyUpdate",
			"data": [False for _ in self.players],
			"showBtn": True
		}))
		# Wait for player login
		while len(self.players) < 2:
			time.sleep(0.3)
			if not self.running: return
		while False in [x.ready for x in self.players]:
			time.sleep(0.3)
			if not self.running: return
		# Reset the ready states and player data
		for p in self.players:
			p.ready = False
			p.piles = [[]]
			p.rider = None
			self.broadcast(json.dumps({
				"type": "RemovePlayer",
				"name": p.name,
				"onlyData": True
			}))
		self.broadcast(json.dumps({
			"type": "ReadyUpdate",
			"data": [False for _ in self.players],
			"showBtn": False
		}))
		# Start dealing!
		self.started = True
		self.dealCards()
	def dealCards(self):
		self.populateDeck()
		# Start dealing
		extraTurns = 20 + (len(self.players) * 3)
		while extraTurns > 0:
			# (while the deck has not run out)
			if len(self.deck) == 0:
				# (a few extra turns for the grounds)
				extraTurns -= 1
			# Do turn
			turn = self.players[self.turn]
			# - Make sure there is at least one pile
			if len(turn.piles) == 0:
				turn.piles.append([])
				self.broadcast(json.dumps({
					"type": "NewPile",
					"player": turn.name
				}))
			# - Deal cards depending on rider
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
		if pileIndex >= len(player.piles): return
		# - Find which card to use
		card = GroundCard()
		if len(self.deck) > 0:
			# (get card from deck)
			card = self.deck.pop()
		else:
			# (special case to skip this player if
			#  they have a ground card)
			if len(player.piles[pileIndex]) > 0 and isinstance(player.piles[pileIndex][-1], GroundCard):
				return
		# - Add the card
		player.piles[pileIndex].append(card)
		self.broadcast(json.dumps({
			"type": "DealCard",
			"player": player.name,
			"pile": pileIndex,
			"card": card.getID()
		}))
		# - Dealing speed
		time.sleep(SECONDS_PER_CARD)

g = Game()

server.events_on_connect.append(g.onConnect)
server.events_on_disconnect.append(g.onDisconnect)
server.events_on_message.append(g.onMessage)
server.run()

# stop the dealing thread
g.deck = []
g.running = False
print()
