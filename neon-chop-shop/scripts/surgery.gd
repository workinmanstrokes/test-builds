class_name Surgery
extends RefCounted
## Phase 1 — Cyber-Surgery Table.
## Diagnose (log names the faulty slot) -> drag the matching implant onto
## the slot -> drag 3 color-coded wires to matching nodes -> complete.
## Heat is the fail lever: 100% Heat = failed surgery = Raid.
## Overclock: +50% payout, Heat gains x1.25 (x1.125 with Governor).

signal heat_changed(value: int)
signal failed(reason: String)
signal completed(payout: int)

const SLOTS := [
	{ "id": "optics", "name": "Optics",         "pos": Vector2(360, 400), "r": 46.0 },
	{ "id": "neural", "name": "Neural Link",     "pos": Vector2(360, 575), "r": 46.0 },
	{ "id": "reflex", "name": "Reflex Booster",  "pos": Vector2(530, 650), "r": 42.0 },
]
const IMPLANTS := [
	{ "slot": "optics", "name": "OPTICS" },
	{ "slot": "neural", "name": "NEURAL" },
	{ "slot": "reflex", "name": "REFLEX" },
]
const WIRE_COLORS := ["red", "blue", "green"]

var state: GameState
var job_num: int = 1
var faulty_slot: String = ""
var diagnosed: bool = false
var seated: String = ""
var implant_name: String = ""
var wires: Dictionary = {}
var overclock: bool = false
var heat: int = 0
var base_payout: int = 150


func _init(p_state: GameState, p_job_num: int) -> void:
	state = p_state
	job_num = p_job_num
	base_payout = 150 + 25 * state.jobs
	faulty_slot = SLOTS[randi() % SLOTS.size()]["id"]


func slot_at(point: Vector2) -> Dictionary:
	for s in SLOTS:
		if point.distance_to(s["pos"]) <= float(s["r"]) + 14.0:
			return s
	return {}


func heat_gain(n: int) -> int:
	var mult := 1.0
	if overclock:
		mult = 1.125 if state.has_blueprint("ocgov") else 1.25
	if state.has_blueprint("reflex2"):
		mult *= 0.8
	return int(round(n * mult))


func add_heat(n: int) -> void:
	heat = mini(100, heat + heat_gain(n))
	heat_changed.emit(heat)
	if heat >= 100:
		failed.emit("Surgery overheated — the implant cooked off mid-operation.")


func diagnose() -> String:
	if diagnosed:
		return ""
	diagnosed = true
	add_heat(5)
	for s in SLOTS:
		if s["id"] == faulty_slot:
			return String(s["name"])
	return ""


## Returns: "seated" | "wrong_slot" | "no_slot" | "not_diagnosed" | "already"
func try_seat_implant(implant_index: int, point: Vector2) -> String:
	if not diagnosed:
		return "not_diagnosed"
	if seated != "":
		return "already"
	var slot := slot_at(point)
	if slot.is_empty():
		return "no_slot"
	var imp: Dictionary = IMPLANTS[implant_index]
	if String(slot["id"]) != String(imp["slot"]):
		add_heat(12)
		return "wrong_slot"
	seated = String(slot["id"])
	implant_name = String(imp["name"])
	add_heat(10)
	return "seated"


## Returns true when the wire lands on its matching node.
func try_connect_wire(color: String, point: Vector2, node_pos: Vector2) -> bool:
	if wires.get(color, false):
		return true
	if point.distance_to(node_pos) <= 42.0:
		wires[color] = true
		add_heat(8)
		return true
	add_heat(6)
	return false


func payout() -> int:
	var p := base_payout
	if state.has_blueprint("optics2"):
		p = int(round(p * 1.25))
	if overclock:
		p = int(round(p * 1.5))
	return p


func is_complete() -> bool:
	if seated == "":
		return false
	for c in WIRE_COLORS:
		if not wires.get(c, false):
			return false
	return true


func complete() -> int:
	if not is_complete():
		return -1
	var pay := payout()
	completed.emit(pay)
	return pay
