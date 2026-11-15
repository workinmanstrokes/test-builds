class_name IceBattler
extends RefCounted
## Phase 2 — ICE Card Battler.
## Turn-based: draw 4 cards per turn (5 with PLA+ Spool), RAM +3 per turn
## (max 10). Attack the 3 firewall ICE nodes. Trace climbs every turn and
## on Overcharge; at 100% the run ends in a Raid. Jack Out banks what you
## stole so far. Destroying all 3 nodes completes the hack.

signal trace_changed(value: int)
signal node_destroyed(node_name: String)
signal hack_completed(stolen: int)
signal raid_triggered(reason: String)

const CARD_DEFS := [
	{ "id": "spike",      "name": "SPIKE",      "cost": 2, "dmg": 3, "trace": 0 },
	{ "id": "spoof",      "name": "SPOOF",      "cost": 1, "dmg": 2, "trace": -5 },
	{ "id": "cloak",      "name": "CLOAK",      "cost": 2, "dmg": 0, "trace": -15 },
	{ "id": "overcharge", "name": "OVERCHARGE", "cost": 3, "dmg": 6, "trace": 10 },
]
const NODE_DEFS := [
	{ "id": "sentry", "name": "SENTRY-7",  "hp": 8 },
	{ "id": "black",  "name": "BLACK ICE",  "hp": 10 },
	{ "id": "gate",   "name": "GATEKEEPER", "hp": 12 },
]
const DECK_COUNTS := { "spike": 4, "spoof": 3, "cloak": 3, "overcharge": 2 }

var state: GameState
var nodes: Array = []       # [{name, hp, max, alive}]
var deck: Array = []
var discard: Array = []
var hand: Array = []
var ram: int = 4
var ram_max: int = 10
var trace: int = 10
var turn: int = 1
var stolen: int = 0
var draw_n: int = 4


func _init(p_state: GameState) -> void:
	state = p_state
	for n in NODE_DEFS:
		nodes.append({ "name": n["name"], "hp": n["hp"], "max": n["hp"], "alive": true })
	for id in DECK_COUNTS:
		for i in DECK_COUNTS[id]:
			deck.append(_card_def(id))
	deck.shuffle()
	ram = 4 + (2 if state.has_blueprint("neural2") else 0)
	draw_n = 5 if state.has_blueprint("plaspool") else 4
	_draw_hand()


func _card_def(id: String) -> Dictionary:
	for c in CARD_DEFS:
		if c["id"] == id:
			return c.duplicate()
	return {}


func _cloak_cut() -> int:
	return 25 if state.has_blueprint("cloakfw") else 15


func _draw_hand() -> void:
	discard.append_array(hand)
	hand.clear()
	for i in draw_n:
		if deck.is_empty():
			deck = discard.duplicate()
			discard.clear()
			deck.shuffle()
			if deck.is_empty():
				break
		hand.append(deck.pop_back())


## Returns: "ok" | "no_ram" | "no_target" | "bad_card"
func play_card(hand_index: int, node_index: int = -1) -> String:
	if hand_index < 0 or hand_index >= hand.size():
		return "bad_card"
	var card: Dictionary = hand[hand_index]
	if ram < int(card["cost"]):
		return "no_ram"
	if int(card["dmg"]) > 0:
		if node_index < 0 or node_index >= nodes.size() or not bool(nodes[node_index]["alive"]):
			return "no_target"
		ram -= int(card["cost"])
		var node: Dictionary = nodes[node_index]
		node["hp"] = int(node["hp"]) - int(card["dmg"])
		trace = maxi(0, trace + int(card["trace"]))
		if int(node["hp"]) <= 0:
			node["hp"] = 0
			node["alive"] = false
			stolen += 100
			node_destroyed.emit(String(node["name"]))
	else:
		ram -= int(card["cost"])
		trace = maxi(0, trace - _cloak_cut())
	discard.append(hand.pop_at(hand_index))
	if nodes.all(func(n): return not bool(n["alive"])):
		stolen += 250
		hack_completed.emit(stolen)
	return "ok"


func end_turn() -> void:
	var gain := 5
	for n in nodes:
		if bool(n["alive"]):
			gain += 3
	trace = mini(100, trace + gain)
	trace_changed.emit(trace)
	if trace >= 100:
		raid_triggered.emit("Trace hit 100% — police triangulated the shop.")
		return
	turn += 1
	ram = mini(ram_max, ram + 3)
	_draw_hand()


func alive_count() -> int:
	var c := 0
	for n in nodes:
		if bool(n["alive"]):
			c += 1
	return c
