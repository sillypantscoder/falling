var w = new WebSocket(`wss://${location.hostname}:8774/`)
w.addEventListener("error", (e) => {
	console.log(e)
})
w.addEventListener("open", (e) => {
	w.send("hey there")
})
w.addEventListener("message", (e) => {
	console.log("recieved data:", e.data)
})

var gid = (/** @type {string} */ id) => document.getElementById(id)
var frame = async (/** @type {number} */ n) => {
	for (var i = 0; i < n; i++) {
		await new Promise((resolve) => requestAnimationFrame(resolve))
	}
}
var time = (/** @type {number} */ ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * @param {HTMLDivElement} card
 * @param {HTMLElement} newParent
 */
function animateCardMove(card, newParent) {
	var oldLocation = card.getBoundingClientRect()
	var previouslyInRiderSlot = card.parentNode == null ? false : (card.parentNode instanceof HTMLElement ? card.classList.contains("rider-slot") : false)
	card.removeAttribute("style")
	if (card.parentNode != null && card.parentNode instanceof HTMLElement) {
		if (card.parentNode.classList.contains("rider-slot")) {
			card.classList.add("rideranimation")
		} else if (newParent.classList.contains("rider-slot")) {
			card.classList.add("rideraddanimation")
		}
	}
	card.remove()
	newParent.appendChild(card)
	var newLocation = card.getBoundingClientRect()
	var difference = {
		x: oldLocation.x - newLocation.x,
		y: oldLocation.y - newLocation.y
	}
	card.setAttribute("style", `top: ${difference.y}px; left: ${difference.x}px;`);
	frame(2).then(() => {
		card.classList.remove("rideranimation")
		card.classList.remove("rideraddanimation")
		card.setAttribute("style", `top: 0px; left: 0px; transition: top ease-in-out 0.3s, left ease-in-out 0.3s, transform ease-in-out 0.3s, box-shadow ease-in-out 0.3s;`)
	})
}

/** @type {HTMLDivElement | null} */
var selected_card = null;

(() => {
	for (var card of [...document.querySelectorAll(".card")]) {
		if (card instanceof HTMLElement) {
			card.addEventListener("mousedown", (e) => {
				var t = e.currentTarget
				if (t == null || t instanceof HTMLDivElement) selected_card = t
			})
		}
	}
	for (var parent of [...document.querySelectorAll(".card-slot")]) {
		if (parent instanceof HTMLElement) {
			parent.addEventListener("mouseup", (e) => {
				var t = e.currentTarget
				if (t != null && t instanceof HTMLDivElement && selected_card != null) {
					animateCardMove(selected_card, t)
				}
				selected_card = null;
			})
		}
	}
})();
