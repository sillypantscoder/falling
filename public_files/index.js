const query = (() => {
	/** @type {Object.<string, string>} */
	var query = {}
	var url = decodeURIComponent(location.href.replaceAll("+", " "))
	var things = url.split("?").slice(1).join("?").split("#")[0].split("&")
	if (Boolean(things[0])) {
		for (var a = 0; a < things.length; a++) {
			var name =  things[a].split("=")[0]
			var value = things[a].split("=")[1]
			query[name] = value
		}
	} else {
		query = {}
	}
	return query
})();

var socket = new WebSocket(`wss://${location.hostname}:8774/`)
socket.addEventListener("error", (e) => {
	console.log(e)
})
socket.addEventListener("open", () => {
	if (my_name != undefined && my_name != "") {
		socket.send(JSON.stringify({
			type: "Login",
			name: my_name
		}))
	}
})
socket.addEventListener("close", () => {
	console.error("Warning! Websocket is disconnected!")
	alert("Lost connection with the server! Refresh to re-join the game.")
})

var my_name = query.name

var gid = (/** @type {string} */ id) => document.getElementById(id)
var frame = async (/** @type {number} */ n) => {
	for (var i = 0; i < n; i++) {
		await new Promise((resolve) => requestAnimationFrame(resolve))
	}
}
var time = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

(() => {
	// Update document size to be correct
	// (for some reason 100vh/100vw doesn't cover full screen)
	const appSize = () => {
		const doc = document.documentElement
		doc.style.setProperty('height', `${window.innerHeight}px`)
		doc.style.setProperty('width', `${window.innerWidth}px`)
	}
	window.addEventListener('resize', appSize)
	frame(3).then(appSize)
})();

/**
 * @typedef {{ x: number, y: number }} Point
 */

/**
 * @param {Point} a
 * @param {Point} b
 */
function dist(a, b) {
	return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2))
}

/**
 * @param {MouseEvent | TouchEvent} event
 * @returns {Point}
 */
function getEventLocation(event) {
	if (event instanceof TouchEvent) {
		return {
			x: event.touches[0].clientX,
			y: event.touches[0].clientY
		}
	} else {
		return {
			x: event.clientX,
			y: event.clientY
		}
	}
}

/**
 * @typedef {"hit" | "skip" | "split" | "extra" | "stop" | "ground"} CardType
 * @type {Object.<string, { name: string, color: string, playOn: { s: boolean, o: boolean } }>}
 */
var card_types = {
	"hit": { name: "Hit", color: "#F88", playOn: { s: false, o: true } },
	"skip": { name: "Skip", color: "#0FF", playOn: { s: true, o: false } },
	"split": { name: "Split", color: "#B9F", playOn: { s: false, o: true } },
	"extra": { name: "Extra", color: "#5F5", playOn: { s: true, o: true } },
	"stop": { name: "Stop", color: "#CC3", playOn: { s: false, o: true } },
	"ground": { name: "GND", color: "#888", playOn: { s: false, o: false } }
}

class Card {
	/**
	 * @param {CardType} type
	 */
	constructor(type) {
		this.elm = document.createElement("div")
		/** @type {CardType} */
		this.type = type
		// Setup element
		this.elm.classList.add("card")
		this.elm.setAttribute("style", `background: ${card_types[type].color};`)
		this.elm.innerText = card_types[type].name
	}
	/**
	 * @param {HTMLElement} newParent
	 * @param {InsertPosition} location
	 */
	animateMove(newParent, location) {
		var card = this.elm
		// Find old location
		var oldLocation = card.getBoundingClientRect()
		card.removeAttribute("style")
		card.classList.add("remove-normal-transitions")
		// Move element to new location
		card.remove()
		newParent.insertAdjacentElement(location, card)
		// Get new location
		var newLocation = card.getBoundingClientRect()
		var difference = {
			x: oldLocation.x - newLocation.x,
			y: oldLocation.y - newLocation.y
		}
		var color = this.getColor()
		card.setAttribute("style", `background: ${color}; top: ${difference.y}px; left: ${difference.x}px;`);
		frame(2).then(() => {
			card.classList.remove("remove-normal-transitions")
			if (newParent.classList.contains("rider-slot")) {
				card.classList.add("rider-card")
			} else {
				card.classList.remove("rider-card")
			}
			card.setAttribute("style", `background: ${color}; top: 0px; left: 0px;`)
		})
	}
	getColor() {
		return card_types[this.type].color
	}
}

class Player {
	/**
	 * @param {string} name
	 * @param {Card[][]} piles
	 * @param {{ rider: Card, extras: Card[] } | null} rider
	 */
	constructor(name, piles, rider) {
		/** @type {string} */
		this.name = name
		/** @type {Card[][]} */
		this.piles = piles
		/** @type {{ rider: Card, extras: Card[] } | null} */
		this.rider = rider
		/** @type {HTMLElement} */
		this.element = this.makeElement()
		document.body.appendChild(this.element)
	}
	makeElement() {
		var e = document.createElement("div")
		e.classList.add("player")
		e.innerHTML = `<div class="card-slot rider-slot"></div><div class="piles"></div><div class="name"></div><div class="ready-btn">Ready!</div>`
		e.setAttribute("style", `--bg-color: hsl(${Math.random() * 360}deg, 40%, 70%);`)
		if (this.name == my_name) e.setAttribute("style", `--bg-color: hsl(${Math.random() * 360}deg, 100%, 50%);`)
		// Player name
		e.children[2].textContent = this.name
		if (this.name == my_name) {
			e.appendChild(document.createElement("b")).innerHTML = "(You)"
		}
		// Add piles
		for (var i = 0; i < this.piles.length; i++) {
			var slot = document.createElement("div")
			e.children[1].appendChild(slot)
			slot.classList.add("card-slot")
			// Add cards
			for (var j = 0; j < this.piles[i].length; j++) {
				slot.appendChild(this.piles[i][j].elm)
			}
		}
		// Add rider
		if (this.rider != null) {
			e.children[0].insertAdjacentElement("afterbegin", this.rider.rider.elm)
			this.rider.rider.elm.classList.add("rider-card")
			this.rider.extras.forEach((v) => {
				e.children[0].insertAdjacentElement("afterbegin", v.elm)
				v.elm.classList.add("rider-card")
			})
		}
		// Return
		return e
	}
}

/** @type {Player[]} */
var players = []

/**
 * @param {string} name
 */
function getPlayerFromName(name) { var p = players.find((v) => v.name == name); if (p == undefined) throw new Error(`Player '${name}' not found`); return p; }
function getMe() { return getPlayerFromName(my_name) }

/**
 * @typedef {{ type: "CreatePlayer", name: string, piles: CardType[][], rider: null | { rider: CardType, extras: CardType[] } }} CreatePlayerMessageType
 * @typedef {{ type: "PlayRider", playerFrom: string, fromPile: number, cardIndex: number, playerTo: string }} PlayRiderMessageType
 * @typedef {{ type: "DealCard", player: string, pile: number, card: CardType }} DealCardMessageType
 * @typedef {{ type: "RemoveRider", player: string, justOneExtra: boolean }} RemoveRiderMessageType
 * @typedef {{ type: "NewPile", player: string }} NewPileMessageType
 * @typedef {{ type: "RemovePile", player: string, pile: number }} RemovePileMessageType
 * @typedef {{ type: "PlayAndDiscard", playerFrom: string, fromPile: number, cardIndex: number, playerTo: string }} PlayAndDiscardMessageType
 * @typedef {{ type: "RemovePlayer", name: string, onlyData: boolean }} RemovePlayerMessageType
 * @typedef {{ type: "ReadyUpdate", data: boolean[], showBtn: boolean }} ReadyUpdateMessageType
 */
socket.addEventListener("message", (e) => {
	/** @type {CreatePlayerMessageType | PlayRiderMessageType | DealCardMessageType | RemoveRiderMessageType | NewPileMessageType | RemovePileMessageType | PlayAndDiscardMessageType | RemovePlayerMessageType | ReadyUpdateMessageType} */
	var data = JSON.parse(e.data)
	if (data.type == "CreatePlayer") {
		var newPlayer = new Player(
			data.name,
			data.piles.map((pile) => pile.map((c) => new Card(c))),
			data.rider == null ? null : { rider: new Card(data.rider.rider), extras: data.rider.extras.map((c) => new Card(c)) }
		)
		players.push(newPlayer)
	} else if (data.type == "PlayRider") {
		// Get data from server
		var playerFrom = getPlayerFromName(data.playerFrom)
		var playerTo = getPlayerFromName(data.playerTo)
		var pile = playerFrom.piles[data.fromPile]
		var card = pile[data.cardIndex]
		// Animate movement
		var newParent = playerTo.element.children[0]
		if (! (newParent instanceof HTMLElement)) throw new Error();
		card.animateMove(newParent, "afterbegin")
		// Structural movement
		pile.splice(data.cardIndex, 1)
		if (playerTo.rider == null) {
			playerTo.rider = {
				rider: card,
				extras: []
			}
		} else {
			playerTo.rider.extras.push(card)
		}
	} else if (data.type == "DealCard") {
		var player = getPlayerFromName(data.player)
		var pile = player.piles[data.pile]
		var card = new Card(data.card)
		card.elm.setAttribute("style", `background: ${card.getColor()}; top: -20em; left: 0;`)
		card.elm.classList.add("no-pickup")
		pile.push(card)
		player.element.children[1].children[data.pile].appendChild(card.elm);
		((card) => {
			frame(2).then(() => {
				card.elm.setAttribute("style", `background: ${card.getColor()}; top: 0; left: 0;`)
			})
			time(400).then(() => {
				card.elm.classList.remove("no-pickup")
			})
		})(card);
	} else if (data.type == "RemoveRider") {
		var player = getPlayerFromName(data.player)
		if (player.rider == null) return;
		var riderElms = [player.rider.rider.elm, ...player.rider.extras.map((v) => v.elm)]
		var riderColors = [player.rider.rider.getColor(), ...player.rider.extras.map((v) => v.getColor())]
		if (data.justOneExtra) {
			riderElms = [player.rider.extras[player.rider.extras.length - 1].elm]
			riderColors = [player.rider.extras[player.rider.extras.length - 1].getColor()]
			player.rider.extras.pop()
		} else player.rider = null
		// Animate movement
		riderElms.forEach((v, i) => {
			v.classList.remove("remove-normal-transitions")
			v.setAttribute("style", `background: ${riderColors[i]}; top: -0em; left: 0;`)
			frame(2).then(() => {
				v.setAttribute("style", `background: ${riderColors[i]}; top: -20em; left: 0;`)
			})
		})
		time(400).then(() => {
			riderElms.forEach((v) => {
				v.remove()
			})
		})
	} else if (data.type == "NewPile") {
		var player = getPlayerFromName(data.player)
		player.piles.push([])
		player.element.children[1].appendChild(document.createElement("div")).classList.add("card-slot")
	} else if (data.type == "RemovePile") {
		var player = getPlayerFromName(data.player)
		player.piles.splice(data.pile, 1)
		player.element.children[1].children[data.pile].remove()
	} else if (data.type == "PlayAndDiscard") {
		// Get data from server
		var playerFrom = getPlayerFromName(data.playerFrom)
		var playerTo = getPlayerFromName(data.playerTo)
		var pile = playerFrom.piles[data.fromPile]
		var card = pile[data.cardIndex]
		// Animate movement
		var newParent = playerTo.element.children[0]
		if (! (newParent instanceof HTMLElement)) throw new Error();
		card.animateMove(newParent, "beforeend")
		frame(3).then(() => {
			card.elm.setAttribute("style", `background: ${card.getColor()}; top: -0.5em; left: -0.5em;`)
		})
		time(400).then(() => {
			card.elm.setAttribute("style", `background: ${card.getColor()}; top: -20em; left: -0.5em;`)
		})
		time(800).then(() => {
			card.elm.remove()
		})
		// Structural movement
		pile.splice(data.cardIndex, 1)
	} else if (data.type == "RemovePlayer") {
		var p = getPlayerFromName(data.name)
		if (!data.onlyData) {
			players.splice(players.indexOf(p), 1)
			p.element.remove()
		} else {
			[...p.element.children[1].children].slice(1).forEach((v) => v.remove());
			[...p.element.children[1].children].forEach((v) => [...v.children].forEach((c) => c.remove()))
			if (p.rider != null) {
				p.rider.rider.elm.remove()
				p.rider.extras.forEach((v) => v.elm.remove())
			}
		}
		p.piles = [[]]
		p.rider = null
	} else if (data.type == "ReadyUpdate") {
		for (var i = 0; i < players.length; i++) {
			var ready = data.data[i]
			// Add or remove active
			if (ready) players[i].element.children[3].classList.add("active")
			else players[i].element.children[3].classList.remove("active")
			// Add the button
			if (data.showBtn && players[i] == getMe() && data.data[i] == false) {
				var btn = getMe().element.children[3]
				if (btn instanceof HTMLDivElement) {
					btn.textContent = "I'm Ready"
					btn.classList.add("button")
					function btnclick() {
						btn.classList.remove("button")
						btn.textContent = "Ready!"
						socket.send(JSON.stringify({
							type: "Ready"
						}))
						btn.removeEventListener("mouseup", btnclick)
						btn.removeEventListener("touchend", btnclick)
					}
					btn.addEventListener("mouseup", btnclick)
					btn.addEventListener("touchend", btnclick)
				}
			}
		}
	} else {
		console.warn("Unknown message recieved...", data)
	}
})

/**
 * @param {number} pile
 * @param {Point} loc
 * @param {number} pileIndex
 */
function mouseDownOnCard(pile, loc, pileIndex) {
	var me = getMe()
	var cardIndex = me.piles[pile].length - 1
	var slide = false
	if (cardIndex > 0 && me.piles[pile][cardIndex].elm.classList.contains("no-pickup")) {
		cardIndex -= 1
		slide = true
	}
	var card = me.piles[pile][cardIndex]
	// Notify server
	socket.send(JSON.stringify({
		type: "GrabCard",
		slide,
		pileIndex
	}))
	// Animation
	card.elm.removeAttribute("style")
	var origin = card.elm.getBoundingClientRect()
	card.elm.classList.add("remove-normal-transitions")
	// Keep track of card pos
	/** @type {Point} */
	var cardPos = { x: 0, y: 0 }
	/** @type {Point} */
	var mousePos = { x: 0, y: 0 }
	var stillClicking = true
	var timeoutID = setTimeout(() => {
		stillClicking = false
		mouseUp(null)
	}, 1500)
	// Set up ticker
	function tick() {
		const easing = 5
		// Move card closer to target
		cardPos = {
			x: ((cardPos.x * easing) + mousePos.x) / (easing + 1),
			y: ((cardPos.y * easing) + mousePos.y) / (easing + 1)
		}
		// Update card
		card.elm.setAttribute("style", `background: ${card.getColor()}; top: ${cardPos.y}px; left: ${cardPos.x}px;`)
		// Loop
		if (stillClicking) requestAnimationFrame(tick)
	}
	// Set up mouse move listener
	/**
	 * @param {Point} loc
	 */
	function mouseMove(loc) {
		mousePos = {
			x: (loc.x - origin.x) - (origin.width / 2),
			y: (loc.y - origin.y) - (origin.height / 2)
		}
	}
	/**
	 * @param {MouseEvent | TouchEvent} event
	 */
	function mouseMoveFromEvent(event) {
		event.preventDefault()
		mouseMove(getEventLocation(event))
	}
	mouseMove(loc)
	// Set up mouse up listener
	/**
	 * @param {MouseEvent | TouchEvent | null} event
	 */
	function mouseUp(event) {
		clearTimeout(timeoutID)
		if (event instanceof MouseEvent) {
			mousePos = {
				x: (event.clientX - origin.x) - (origin.width / 2),
				y: (event.clientY - origin.y) - (origin.height / 2)
			}
		}
		document.body.removeEventListener("mousemove", mouseMoveFromEvent)
		document.body.removeEventListener("touchmove", mouseMoveFromEvent)
		document.body.removeEventListener("mouseup", mouseUp)
		document.body.removeEventListener("touchend", mouseUp)
		// Finish dragging the card
		if (stillClicking) {
			frame(2).then(() => {
				cardDragEnd(card, { x: mousePos.x + origin.x, y: mousePos.y + origin.y })
			})
		} else {
			socket.send(JSON.stringify({
				type: "PlayCard",
				target: null
			}))
		}
		stillClicking = false
		frame(2).then(() => {
			// Start reverting the card...
			card.elm.classList.remove("remove-normal-transitions")
			card.elm.setAttribute("style", `background: ${card.getColor()}; top: 0; left: 0;`)
		})
	}
	// Start!
	document.body.addEventListener("mousemove", mouseMoveFromEvent)
	document.body.addEventListener("touchmove", mouseMoveFromEvent, { passive: false })
	document.body.addEventListener("mouseup", mouseUp)
	document.body.addEventListener("touchend", mouseUp, { passive: false })
	tick()
}
document.body.addEventListener("touchstart", (event) => {
	var me = getMe()
	/** @type {Point[]} */
	var pile_locations = me.piles.map((v, i) => me.element.children[1].children[i].getBoundingClientRect()).map((v) => ({
		x: v.x + (v.width / 2),
		y: v.y + (v.height / 2)
	}))
	var distances = pile_locations.map((v) => dist(getEventLocation(event), v))
	var minDistI = distances.findIndex((v) => v == Math.min(...distances))
	if (distances[minDistI] < 200) {
		// close enough to one of the piles
		var pile = me.piles[minDistI]
		if (pile.length > 0) {
			var card = pile[pile.length - 1]
			if (card.type != "ground") {
				mouseDownOnCard(minDistI, getEventLocation(event), minDistI)
			}
		}
	}
	event.preventDefault()
}, { passive: false })

/**
 * @param {Card} card
 * @param {Point} mousePos
 */
function cardDragEnd(card, mousePos) {
	// find closest player to release point
	/** @type {Point[]} */
	var player_locations = players.map((v) => v.element.getBoundingClientRect()).map((v) => ({
		x: v.x + (v.width / 2),
		y: v.y + (v.height / 2)
	}));
	// (testing code to see where the locations are)
	// [...player_locations, mousePos].forEach((v) => {
	// 	var e = document.createElement("div")
	// 	e.setAttribute("style", `position: absolute; top: ${v.y}px; left: ${v.x}px; outline: 1em solid black;`)
	// 	document.body.appendChild(e)
	// })
	var distances = player_locations.map((v) => dist(mousePos, v))
	var closestPlayer = players[distances.findIndex((v) => v == Math.min(...distances))]
	if (closestPlayer == getMe() && mousePos.y > window.innerHeight / 2) return socket.send(JSON.stringify({
		type: "PlayCard",
		target: null
	}))
	// Send a play-card message to the server
	socket.send(JSON.stringify({
		type: "PlayCard",
		target: closestPlayer.name
	}))
}

(() => {
	if (query.bot != "true") return;
	// Bot mode!
	function tick() {
		// 1. Check if we have any ground cards
		try {
			var me = getMe()
		} catch {
			return
		}
		if (me.piles.find((v) => v.find((c) => c.type=="ground") != null) != null) {
			clearInterval(id)
			return
		}
		// 2. Try to play a card
		if (me.piles.length == 0) return
		//    a. Pick a random card
		var pile = Math.floor(Math.random() * me.piles.length)
		var card = me.piles[pile][me.piles[pile].length - 1]
		if (card == undefined) return
		//    b. Pick a random player
		var targetPlayer = players[Math.floor(Math.random() * players.length)]
		//    c. Determine whether this is a good idea
		var playOn = card_types[card.type].playOn
		var validPlay = targetPlayer==me ? playOn.s : playOn.o
		//    d. Play the card
		if (validPlay) {
			socket.send(JSON.stringify({
				type: "GrabCard",
				slide: false,
				pileIndex: pile
			}))
			socket.send(JSON.stringify({
				type: "PlayCard",
				target: targetPlayer.name
			}))
		}
	}
	var id = setInterval(tick, 600)
})();
