class_name SaveManager
## Persistent local save (user://). JSON, with an in-code default on first run.
## Tester update (VEX): goldCaught counts rare gold fish landed, daily is
## the day's target (LakesData.daily_target) with its done flag. Old saves
## pick both up automatically — load_save merges stored keys over defaults.
extends RefCounted

const SAVE_PATH := "user://lunker_rush_save.json"


static func default_save() -> Dictionary:
	return {
		"coins": 0,
		"lures": {"senko": true},
		"lines": {"braid15": true},
		"equippedLure": "senko",
		"equippedLine": "braid15",
		"caught": {},
		"totalCaught": 0,
		"best": {},
		"goldCaught": 0,
		"daily": {},
	}


static func load_save() -> Dictionary:
	var save: Dictionary = default_save()
	if not FileAccess.file_exists(SAVE_PATH):
		return save
	var text: String = FileAccess.get_file_as_string(SAVE_PATH)
	var parsed: Variant = JSON.parse_string(text)
	if parsed is Dictionary:
		for key in parsed.keys():
			save[key] = parsed[key]
	return save


static func persist(save: Dictionary) -> void:
	var file: FileAccess = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file:
		file.store_string(JSON.stringify(save))
		file.close()
