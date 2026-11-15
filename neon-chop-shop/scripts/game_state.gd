class_name GameState
extends RefCounted
## Persistent shop state. Banked credits + unlocked 3D-printer blueprints
## SURVIVE raids. Unbanked credits and the active implant live in memory
## only (see main.gd / raid.gd) and are wiped by a Raid.
## Saved as JSON to user://neon_chop_shop_save.json

const SAVE_PATH := "user://neon_chop_shop_save.json"

const BLUEPRINTS := [
	{ "id": "optics2",  "name": "Optics Mk II",         "cost": 200, "desc": "+25% surgery payout" },
	{ "id": "neural2",  "name": "Neural Link Mk II",    "cost": 200, "desc": "Start ICE battles with +2 RAM" },
	{ "id": "reflex2",  "name": "Reflex Booster Mk II", "cost": 200, "desc": "Surgery generates 20% less Heat" },
	{ "id": "cloakfw",  "name": "Cloak Firmware",       "cost": 300, "desc": "Cloak cards cut Trace by 25 (was 15)" },
	{ "id": "ocgov",    "name": "Overclock Governor",   "cost": 300, "desc": "Overclock Heat penalty halved" },
	{ "id": "plaspool", "name": "PLA+ Spool",           "cost": 150, "desc": "Draw 5 cards per ICE turn (was 4)" },
]

var banked: int = 0
var blueprints: Dictionary = {}
var jobs: int = 0
var raids: int = 0
var hacks: int = 0
var best: int = 0


func has_blueprint(id: String) -> bool:
	return blueprints.get(id, false)


func buy_blueprint(id: String) -> bool:
	for bp in BLUEPRINTS:
		if bp["id"] == id:
			if has_blueprint(id):
				return false
			if banked < int(bp["cost"]):
				return false
			banked -= int(bp["cost"])
			blueprints[id] = true
			save()
			return true
	return false


func bank_credits(amount: int) -> void:
	banked += amount
	best = maxi(best, banked)
	save()


func to_dict() -> Dictionary:
	return {
		"banked": banked,
		"blueprints": blueprints,
		"jobs": jobs,
		"raids": raids,
		"hacks": hacks,
		"best": best,
	}


func save() -> void:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(to_dict()))
		file.close()


static func load() -> GameState:
	var state := GameState.new()
	if not FileAccess.file_exists(SAVE_PATH):
		return state
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if not file:
		return state
	var data: Variant = JSON.parse_string(file.get_as_text())
	file.close()
	if data is Dictionary:
		state.banked = int(data.get("banked", 0))
		state.blueprints = data.get("blueprints", {})
		state.jobs = int(data.get("jobs", 0))
		state.raids = int(data.get("raids", 0))
		state.hacks = int(data.get("hacks", 0))
		state.best = int(data.get("best", 0))
	return state
