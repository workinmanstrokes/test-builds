class_name Workbench
## 3D-printer Workbench: buy/equip PLA lures and line upgrades against a save dict.
extends RefCounted


static func buy(save: Dictionary, kind: String, id: String) -> Dictionary:
	var catalog: Dictionary = LakesData.LURES if kind == "lure" else LakesData.LINES
	if not catalog.has(id):
		return {"ok": false, "why": "no such item"}
	var item: Dictionary = catalog[id]
	var owned: Dictionary = save["lures"] if kind == "lure" else save["lines"]
	if owned.has(id):
		return {"ok": false, "why": "already owned"}
	if int(save["coins"]) < int(item["cost"]):
		return {"ok": false, "why": "not enough coins"}
	save["coins"] = int(save["coins"]) - int(item["cost"])
	owned[id] = true
	if kind == "lure":
		save["equippedLure"] = id
	else:
		save["equippedLine"] = id
	return {"ok": true}


static func equip(save: Dictionary, kind: String, id: String) -> bool:
	var owned: Dictionary = save["lures"] if kind == "lure" else save["lines"]
	if not owned.has(id):
		return false
	if kind == "lure":
		save["equippedLure"] = id
	else:
		save["equippedLine"] = id
	return true
