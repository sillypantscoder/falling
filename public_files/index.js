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
var time = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @typedef {"hit" | "skip" | "extra"} CardType
 */

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
		this.elm.classList.add("card")
		this.elm.setAttribute("style", `background: ${card_types[type].color};`)
		/** @type {CardType} */
		this.type = type
	}
	/**
	 * @param {HTMLElement} newParent
	 */
	animateMove(newParent) {
		var card = this.elm
		var oldLocation = card.getBoundingClientRect()
		card.classList.remove("normal-transitions")
		card.remove()
		newParent.appendChild(card)
		var newLocation = card.getBoundingClientRect()
		var difference = {
			x: oldLocation.x - newLocation.x,
			y: oldLocation.y - newLocation.y
		}
		var color = card_types[this.type].color
		card.setAttribute("style", `background: ${color}; top: ${difference.y}px; left: ${difference.x}px;`);
		frame(2).then(() => {
			card.classList.add("normal-transitions")
			if (newParent.classList.contains("rider-slot")) {
				card.classList.add("rider-card")
			} else {
				card.classList.remove("rider-card")
			}
			card.setAttribute("style", `background: ${color}; top: 0px; left: 0px;`)
		})
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