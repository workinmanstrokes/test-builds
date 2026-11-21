class_name Surgery
extends RefCounted
## Phase 1 — Cyber-Surgery Table (tester update, VEX 2.5/10).
## Diagnose is now a real decision: the log shows conflicting symptoms
## and the player must CALL the faulty slot. A wrong call costs 25
## Stability, 5 Reputation and 10 Heat, and the diagnosis stays open.
## Wrong slot / missed wire damage the client (Stability); Stability 0
## flatlines the client and fails the surgery. Overclock is a gamble:
## +50% payout, but a 25% malfunction chance halves the payout.
## Implant variants trade pay for risk: Factory (safe) vs Street chip
## (+30% pay, +15 Heat, -10 Stability on seating).
## Heat is the fail lever: 100% Heat = failed surgery = Raid.
## Overclock: +50% payout, Heat gains x1.25 (x1.125 with Governor).

signal heat_changed(value: int)
signal stability_changed(value: int)
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
# Touch pass: snap zones are generous on purpose (mobile, one-handed).
const SLOT_SNAP_PAD := 34.0
const WIRE_SNAP_R := 56.0
const MALFUNCTION_CHANCE := 0.25

var state: GameState
var job_num: int = 1
var faulty_slot: String = ""
var diagnosed: bool = false
var diagnosed_slot: String = ""
var diagnosis_locked: bool = false
var seated: String = ""
var implant_name: String = ""
var variant: String = "factory"  # "factory" | "street"
var wires: Dictionary = {}
var overclock: bool = false
var heat: int = 0
var stability: int = 100
var mistakes: int = 0
var base_payout: int = 150
var history: Array = []  # undo stack: {"kind": "seat"/"wire", "color": ...}
var last_breakdown: Dictionary = {}
var last_malfunction: bool = false


func _init(p_state: GameState, p_job_num: int) -> void:
	state = p_state
	job_num = p_job_num
	base_payout = 150 + 25 * state.jobs
	faulty_slot = SLOTS[randi() % SLOTS.size()]["id"]


func slot_at(point: Vector2) -> Dictionary:
	for s in SLOTS:
		if point.distance_to(s["pos"]) <= float(s["r"]) + SLOT_SNAP_PAD:
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


func damage_stability(n: int, why: String) -> void:
	stability = maxi(0, stability - n)
	stability_changed.emit(stability)
	if stability <= 0:
		failed.emit("Client flatlined on the table (%s)." % why)


func diagnose() -> String:
	if diagnosed:
		return ""
	diagnosed = true
	add_heat(5)
	for s in SLOTS:
		if s["id"] == faulty_slot:
			return String(s["name"])
	return ""


## The diagnosis call. Returns "correct" | "wrong" | "already" | "not_ready".
func choose_diagnosis(slot_id: String) -> String:
	if not diagnosed or diagnosis_locked:
		return "not_ready" if not diagnosed else "already"
	if slot_id == faulty_slot:
		diagnosed_slot = slot_id
		diagnosis_locked = true
		return "correct"
	mistakes += 1
	state.add_reputation(-5)
	damage_stability(25, "wrong diagnosis")
	add_heat(10)
	return "wrong"


## Returns: "seated" | "wrong_slot" | "no_slot" | "not_diagnosed" | "already"
func try_seat_implant(implant_index: int, point: Vector2) -> String:
	if not diagnosis_locked:
		return "not_diagnosed"
	if seated != "":
		return "already"
	var slot := slot_at(point)
	if slot.is_empty():
		return "no_slot"
	var imp: Dictionary = IMPLANTS[implant_index]
	if String(slot["id"]) != String(imp["slot"]):
		mistakes += 1
		state.add_reputation(-5)
		damage_stability(25, "wrong slot")
		add_heat(12)
		return "wrong_slot"
	seated = String(slot["id"])
	implant_name = String(imp["name"])
	history.append({ "kind": "seat" })
	if variant == "street":
		add_heat(25)
		damage_stability(10, "street chip")
	else:
		add_heat(10)
	return "seated"


## Returns true when the wire lands on its matching node.
func try_connect_wire(color: String, point: Vector2, node_pos: Vector2) -> bool:
	if wires.get(color, false):
		return true
	if point.distance_to(node_pos) <= WIRE_SNAP_R:
		wires[color] = true
		history.append({ "kind": "wire", "color": color })
		add_heat(8)
		return true
	mistakes += 1
	damage_stability(5, "misrouted wire")
	add_heat(6)
	return false


## Undo the last seat / wire. Heat and damage stay — undo is not free.
func undo_last() -> String:
	if history.is_empty():
		return "nothing"
	var last: Dictionary = history.pop_back()
	if String(last["kind"]) == "seat":
		seated = ""
		implant_name = ""
		return "seat"
	wires[String(last["color"])] = false
	return "wire"


func payout() -> int:
	var p := base_payout
	if state.has_blueprint("optics2"):
		p = int(round(p * 1.25))
	if variant == "street":
		p = int(round(p * 1.3))
	if overclock:
		p = int(round(p * 1.5))
	return p


func score_breakdown() -> Dictionary:
	var p := base_payout
	var lines: Array[String] = ["Base fee: %dcr" % base_payout]
	if state.has_blueprint("optics2"):
		var b := int(round(p * 0.25))
		p += b
		lines.append("Optics Mk II blueprint: +%dcr" % b)
	if variant == "street":
		var v := int(round(p * 0.3))
		p += v
		lines.append("Street chip risk premium: +%dcr" % v)
	if overclock:
		var o := int(round(p * 0.5))
		p += o
		lines.append("Overclock bonus: +%dcr" % o)
	if stability >= 90:
		p += 15
		lines.append("Clean table (stability %d%%): +15cr" % stability)
	elif stability < 50:
		p -= 25
		lines.append("Rough surgery (stability %d%%): -25cr" % stability)
	var pen := mistakes * 10
	if pen > 0:
		p -= pen
		lines.append("Mistakes x%d: -%dcr" % [mistakes, pen])
	return { "total": maxi(0, p), "lines": lines }


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
	var bd := score_breakdown()
	var pay := int(bd["total"])
	last_malfunction = false
	if overclock and randf() < MALFUNCTION_CHANCE:
		last_malfunction = true
		pay = pay / 2
		damage_stability(20, "overclock malfunction")
		bd["lines"].append("OVERCLOCK MALFUNCTION: payout halved to %dcr" % pay)
		if stability <= 0:
			# Client flatlined: failed already emitted, do not also complete.
			last_breakdown = bd
			return -1
	last_breakdown = bd
	completed.emit(pay)
	return pay
