class_name Tycoon
extends Node
## Minimum tycoon layer for the Godot build: day progression, daily
## rent, one shop upgrade, and save/load. The web build already has the
## fuller upgrade list (lamp, calipers, prep station, bulk account, VIP
## slots); this is the Godot parity slice — one upgrade that visibly
## changes buyer demand, plus the daily cost that makes cash matter.
## Main creates this node in _ready; no scene edit is needed.

signal day_changed(new_day: int)
signal upgrade_bought(upgrade_key: String)

const SAVE_PATH := "user://slab-house-save.json"
const RENT_PER_DAY := 15

const UPGRADES := {
	"neon_sign": {
		"name": "Neon Sign",
		"cost": 150,
		"desc": "+15% buyer demand: raw sales, slab sales and fixed offers pay more.",
	},
}

var day: int = 1
var owned_upgrades: Array[String] = []

func demand_mult() -> float:
	return 1.15 if owned_upgrades.has("neon_sign") else 1.0

func buy_upgrade(economy: Economy, key: String) -> Dictionary:
	if not UPGRADES.has(key):
		return {"ok": false, "reason": "Unknown upgrade."}
	if owned_upgrades.has(key):
		return {"ok": false, "reason": "Already owned."}
	var cost: int = UPGRADES[key]["cost"]
	if economy.cash < cost:
		return {"ok": false, "reason": "Need $%d for the %s." % [cost, UPGRADES[key]["name"]]}
	economy.cash -= cost
	economy.cash_changed.emit(economy.cash)
	owned_upgrades.append(key)
	economy.demand_mult = demand_mult()
	upgrade_bought.emit(key)
	return {"ok": true, "name": UPGRADES[key]["name"], "cost": cost}

## Ends the day: rent comes out of cash (never below $0 — the unpaid
## remainder is reported as a shortfall, not hidden), then the day ticks.
func end_day(economy: Economy) -> Dictionary:
	var paid: int = mini(RENT_PER_DAY, economy.cash)
	economy.cash -= paid
	economy.cash_changed.emit(economy.cash)
	day += 1
	day_changed.emit(day)
	return {
		"ok": true,
		"rent_due": RENT_PER_DAY,
		"rent_paid": paid,
		"shortfall": RENT_PER_DAY - paid,
		"day": day,
		"cash": economy.cash,
	}

func save_game(economy: Economy) -> Dictionary:
	var cards: Array = []
	for c in economy.inventory:
		cards.append(_card_to_dict(c))
	var data := {
		"version": 1,
		"cash": economy.cash,
		"day": day,
		"upgrades": owned_upgrades,
		"stats": economy.stats,
		"cards": cards,
	}
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f == null:
		return {"ok": false, "reason": "Could not open the save file."}
	f.store_string(JSON.stringify(data))
	return {"ok": true}

func load_game(economy: Economy) -> Dictionary:
	if not FileAccess.file_exists(SAVE_PATH):
		return {"ok": false, "reason": "No save found."}
	var f := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if f == null:
		return {"ok": false, "reason": "Could not open the save file."}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	if parsed == null or not (parsed is Dictionary):
		return {"ok": false, "reason": "Save file is corrupt."}
	var data: Dictionary = parsed
	economy.cash = int(data.get("cash", Economy.START_CASH))
	day = int(data.get("day", 1))
	owned_upgrades.clear()
	for u in data.get("upgrades", []):
		owned_upgrades.append(String(u))
	economy.demand_mult = demand_mult()
	var saved_stats: Dictionary = data.get("stats", {})
	for k in saved_stats:
		if economy.stats.has(k):
			economy.stats[k] = int(saved_stats[k])
	economy.inventory.clear()
	var max_uid := 0
	for d in data.get("cards", []):
		var c := _dict_to_card(d)
		economy.inventory.append(c)
		max_uid = maxi(max_uid, c.uid)
	CardData._next_uid = max_uid + 1
	economy.cash_changed.emit(economy.cash)
	economy.inventory_changed.emit()
	day_changed.emit(day)
	return {"ok": true, "day": day, "cards": economy.inventory.size()}

func _card_to_dict(c: CardData) -> Dictionary:
	return {
		"uid": c.uid, "set_key": c.set_key, "set_name": c.set_name,
		"card_name": c.card_name, "title": c.title, "rarity": c.rarity,
		"art": c.art, "base_value": c.base_value,
		"centering_lr": c.centering_lr, "centering_tb": c.centering_tb,
		"corners_whitened": c.corners_whitened, "edge_wear": c.edge_wear,
		"surface_lines": c.surface_lines, "graded": c.graded,
		"grade": c.grade, "grade_mult": c.grade_mult,
		"slab_value": c.slab_value,
	}

func _dict_to_card(d: Dictionary) -> CardData:
	var c := CardData.new()
	c.uid = int(d.get("uid", 0))
	c.set_key = String(d.get("set_key", ""))
	c.set_name = String(d.get("set_name", ""))
	c.card_name = String(d.get("card_name", ""))
	c.title = String(d.get("title", ""))
	c.rarity = String(d.get("rarity", "common"))
	c.art = String(d.get("art", "🃏"))
	c.base_value = int(d.get("base_value", 1))
	c.centering_lr = int(d.get("centering_lr", 50))
	c.centering_tb = int(d.get("centering_tb", 50))
	var corners: Array[bool] = [false, false, false, false]
	var saved_corners: Array = d.get("corners_whitened", [])
	for i in mini(4, saved_corners.size()):
		corners[i] = bool(saved_corners[i])
	c.corners_whitened = corners
	c.edge_wear = int(d.get("edge_wear", 0))
	c.surface_lines = int(d.get("surface_lines", 0))
	c.graded = bool(d.get("graded", false))
	c.grade = int(d.get("grade", 0))
	c.grade_mult = float(d.get("grade_mult", 1.0))
	c.slab_value = int(d.get("slab_value", 0))
	return c
