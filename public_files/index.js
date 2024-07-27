var socket = new WebSocket(`wss://${location.hostname}:8774/`)
socket.addEventListener("error", (e) => {
	console.log(e)
})
socket.addEventListener("open", () => {
})
socket.addEventListener("close", () => {
	console.error("Warning! Websocket is disconnected!")
})

var gid = (/** @type {string} */ id) => document.getElementById(id)
var frame = async (/** @type {number} */ n) => {
	for (var i = 0; i < n; i++) {
		await new Promise((resolve) => requestAnimationFrame(resolve))
	}
}
var time = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms));

(() => {
	// Update document height to be correct
	// (for some reason 100vh doesn't cover full screen)
	const appHeight = () => {
		const doc = document.documentElement
		doc.style.setProperty('height', `${window.innerHeight}px`)
	}
	window.addEventListener('resize', appHeight)
	frame(3).then(appHeight)
})();

/**
 * @typedef {"hit" | "skip" | "extra"} CardType
 * @typedef {{ x: number, y: number }} Point
 */

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

/** @type {Object.<string, { name: string, color: string }>} */
var card_types = {
	"hit": { "name": "Hit", "color": "#F88" },
	"skip": { "name": "Skip", "color": "#0FF" },
	"extra": { "name": "Extra", "color": "#5F5" }
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
		var _card = this
		this.elm.addEventListener("touchstart", (event) => {
			mouseDownOnCard(_card, getEventLocation(event))
			event.preventDefault()
		})
	}
	/**
	 * @param {HTMLElement} newParent
	 */
	animateMove(newParent) {
		var card = this.elm
		var oldLocation = card.getBoundingClientRect()
		card.classList.add("remove-normal-transitions")
		card.remove()
		newParent.appendChild(card)
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
		e.innerHTML = `<div class="card-slot rider-slot"></div><div class="piles"></div><div class="name"></div>`
		e.setAttribute("style", `--bg-color: hsl(${Math.random() * 360}deg, 40%, 50%);`)
		// Player name
		e.children[2].textContent = this.name
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

socket.addEventListener("message", (e) => {
	/** @type {{ type: "CreatePlayer", name: string, piles: CardType[][], rider: null | { rider: CardType, extras: CardType[] } } | { type: "Disconnected" }} */
	var data = JSON.parse(e.data)
	if (data.type == "CreatePlayer") {
		var newPlayer = new Player(
			data.name,
			data.piles.map((pile) => pile.map((c) => new Card(c))),
			data.rider == null ? null : { rider: new Card(data.rider.rider), extras: data.rider.extras.map((c) => new Card(c)) }
		)
		players.push(newPlayer)
	} else {
		console.warn("Unknown message recieved...", data)
	}
})
/**
 * @param {Card} card
 * @param {Point} loc
 */
function mouseDownOnCard(card, loc) {
	card.elm.removeAttribute("style")
	var origin = card.elm.getBoundingClientRect()
	card.elm.classList.add("remove-normal-transitions")
	// Keep track of card pos
	/** @type {Point} */
	var cardPos = { x: 0, y: 0 }
	/** @type {Point} */
	var mousePos = { x: 0, y: 0 }
	var stillClicking = true
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
	 * @param {MouseEvent | TouchEvent} event
	 */
	function mouseUp(event) {
		if (event instanceof MouseEvent) {
			mousePos = {
				x: (event.clientX - origin.x) - (origin.width / 2),
				y: (event.clientY - origin.y) - (origin.height / 2)
			}
		}
		document.body.removeEventListener("mousemove", mouseMoveFromEvent)
		// @ts-ignore passive doesn't exist (?)
		document.body.removeEventListener("touchmove", mouseMoveFromEvent, { passive: false })
		document.body.removeEventListener("mouseup", mouseUp)
		// @ts-ignore passive doesn't exist (?)
		document.body.removeEventListener("touchend", mouseUp, { passive: false })
	}
	// Start!
	document.body.addEventListener("mousemove", mouseMoveFromEvent)
	document.body.addEventListener("touchmove", mouseMoveFromEvent, { passive: false })
	document.body.addEventListener("mouseup", mouseUp)
	document.body.addEventListener("touchend", mouseUp, { passive: false })
	tick()
}
