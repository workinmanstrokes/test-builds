extends Node2D
## Michigan Lunker Rush — Godot 4 controller (Milestone 1-3 vertical slice).
## Mirrors the HTML5 version in index.html: same lakes, weather, drone,
## casting, tension fight, workbench and save shape.
## Tester update (VEX, 2026-11-20): species fight profiles, drone reveals
## depth/cover and boosts bites on revealed spots, a visible first fish so
## the first loop teaches itself, gold fish + daily target + personal bests
## as the one retention hook, and a wider one-handed tension bar with a
## visible danger zone. See docs/TESTER-RESPONSE.md for the item-by-item map.

const W := 720.0
const H := 1280.0
const WATER_TOP := 300.0
const WATER_BOT := 1020.0

var save: Dictionary = {}
var scene: String = "menu" # menu | fishing | workbench
var lake: Dictionary = {}
var weather := WeatherSystem.new()
var drone := ScoutDrone.new()
var casting := Casting.new()
var tension := TensionGame.new()
var fish: Array = []
var result: Dictionary = {}
var msg: String = ""
var msg_t: float = 0.0
var time: float = 0.0
var _hot: Array = [] # clickable rects rebuilt every _draw: {"id": String, "rect": Rect2}
var _font: Font


func _ready() -> void:
	_font = ThemeDB.fallback_font
	save = SaveManager.load_save()
	_ensure_daily()


func enter_lake(lake_id: String) -> void:
	lake = LakesData.LAKES[lake_id]
	scene = "fishing"
	casting = Casting.new()
	tension = TensionGame.new()
	result = {}
	drone = ScoutDrone.new()
	weather.roll()
	_spawn_fish()
	_ensure_daily()
	# First trip only: the first cast bites almost at once, so cast ->
	# bite -> strike -> fight -> land completes in under 60 seconds.
	casting.quick_bite = int(save["totalCaught"]) == 0
	set_msg(lake["name"] + " — " + str(weather.current["name"]), 2.5)


## The day's target (one named fish). Rolls over at midnight; landing it
## pays the bonus in _end_fight.
func _ensure_daily() -> void:
	var today: String = Time.get_date_string_from_system()
	var daily: Dictionary = save.get("daily", {})
	if String(daily.get("date", "")) != today:
		save["daily"] = LakesData.daily_target(today)
		SaveManager.persist(save)


func _spawn_fish() -> void:
	fish = []
	var species_list: Array = lake["species"]
	for i in 6:
		var sp: Dictionary = species_list[randi() % species_list.size()]
		fish.append(_make_fish(sp))
	# First trip: one panfish feeds in plain sight, mid-water, so the
	# first cast has a visible target — no tutorial card, and it stops
	# mattering after the first catch (see _draw_fishing coach text).
	if int(save["totalCaught"]) == 0:
		var pan: Dictionary = species_list[0]
		for s in species_list:
			if float(s["fight"]) <= 0.3:
				pan = s
				break
		var first: Dictionary = _make_fish(pan)
		first["weight"] = randf_range(float(pan["min"]), float(pan["min"]) + 0.3)
		first["pos"] = Vector2(W / 2, WATER_TOP + 180.0)
		first["vx"] = 8.0
		first["cover"] = "OPEN"
		first["gold"] = false
		fish[0] = first


## One swimming fish: species, weight, position, drift, and the things the
## drone reveals — depth, cover, and whether it is a rare gold fish.
func _make_fish(sp: Dictionary) -> Dictionary:
	var gold: bool = int(save["totalCaught"]) > 0 and randf() < LakesData.GOLD_CHANCE
	return {
		"species": sp,
		"weight": randf_range(float(sp["min"]), float(sp["max"])),
		"pos": Vector2(randf_range(60.0, W - 60.0), randf_range(WATER_TOP + 60.0, WATER_BOT - 60.0)),
		"vx": randf_range(-14.0, 14.0),
		"depth": LakesData.roll_depth(String(sp["id"])),
		"cover": LakesData.roll_cover(),
		"gold": gold,
		"revealed": false,
	}


func set_msg(text: String, dur: float = 2.2) -> void:
	msg = text
	msg_t = dur


func _process(delta: float) -> void:
	time += delta
	if msg_t > 0.0:
		msg_t -= delta
	drone.update(delta, fish)
	for f in fish:
		var pos: Vector2 = f["pos"]
		pos.x += float(f["vx"]) * delta
		if pos.x < 50.0 or pos.x > W - 50.0:
			f["vx"] = -float(f["vx"])
		f["pos"] = pos
	if casting.phase == "fight":
		var end: String = tension.update(delta, casting.hooked, LakesData.LINES[save["equippedLine"]], weather.current)
		if end != "":
			_end_fight(end)
	else:
		var struck: Dictionary = casting.update(delta, fish, String(save["equippedLure"]), weather.current)
		if not struck.is_empty():
			set_msg("STRIKE! TAP NOW!", 1.2)
	queue_redraw()


func _end_fight(kind: String) -> void:
	var hooked: Dictionary = casting.hooked
	casting.phase = "result"
	if kind == "caught":
		var base: int = int(round(float(hooked["weight"]) * float(hooked["species"]["coins"])))
		var is_trophy: bool = float(hooked["weight"]) >= float(hooked["species"]["max"]) * 0.9
		var coins: int = int(round(base * 1.5)) if is_trophy else base
		var is_gold: bool = bool(hooked.get("gold", false))
		if is_gold:
			coins = int(round(coins * LakesData.GOLD_COIN_MULT))
			save["goldCaught"] = int(save.get("goldCaught", 0)) + 1
		save["coins"] = int(save["coins"]) + coins
		save["totalCaught"] = int(save["totalCaught"]) + 1
		var caught: Dictionary = save["caught"]
		var sid: String = String(hooked["species"]["id"])
		caught[sid] = int(caught.get(sid, 0)) + 1
		var best: Dictionary = save["best"]
		var prev_best: float = float(best.get(sid, 0.0))
		# Personal best, bass & pike only — the "one more cast" hook.
		var is_pb: bool = (sid == "largemouth" or sid == "smallmouth" or sid == "pike") and float(hooked["weight"]) > prev_best
		if float(hooked["weight"]) > prev_best:
			best[sid] = snappedf(float(hooked["weight"]), 0.1)
		var note: String = ""
		if is_pb:
			note = "NEW PERSONAL BEST — %s %.1f lb!" % [String(hooked["species"]["name"]), float(hooked["weight"])]
		# Daily target: one named fish a day, bonus coins when it is landed.
		var daily: Dictionary = save.get("daily", {})
		if not daily.is_empty() and not bool(daily.get("done", false)) and String(daily.get("species", "")) == sid and float(hooked["weight"]) >= float(daily.get("min_weight", 0.0)):
			var bonus: int = int(daily.get("bonus", LakesData.DAILY_BONUS))
			save["coins"] = int(save["coins"]) + bonus
			coins += bonus
			daily["done"] = true
			save["daily"] = daily
			var target_note: String = "DAILY TARGET DONE! +%d coins" % bonus
			note = target_note if note == "" else note + "  •  " + target_note
		SaveManager.persist(save)
		result = {"kind": "caught",
			"title": ("GOLD! " if is_gold else "") + ("TROPHY! " if is_trophy else "") + String(hooked["species"]["name"]),
			"sub": "%.1f lb landed" % float(hooked["weight"]), "coins": coins, "note": note}
		# Landed fish leaves; a new one swims in.
		fish.erase(hooked)
		var species_list: Array = lake["species"]
		var sp: Dictionary = species_list[randi() % species_list.size()]
		fish.append(_make_fish(sp))
	elif kind == "snap":
		result = {"kind": "snap", "title": "LINE SNAPPED!",
			"sub": "The " + String(LakesData.LINES[save["equippedLine"]]["name"]) + " couldn't take it.", "coins": 0}
	else:
		result = {"kind": "spit", "title": "IT SPIT THE HOOK",
			"sub": "Too much slack — keep tapping to stay tight.", "coins": 0}
	casting.hooked = {}


# ---------------- Input ----------------
func _input(event: InputEvent) -> void:
	var pos := Vector2.ZERO
	var pressed := false
	var released := false
	var dragged := false
	if event is InputEventScreenTouch:
		var t: InputEventScreenTouch = event
		pos = t.position
		pressed = t.pressed
		released = not t.pressed
	elif event is InputEventScreenDrag:
		var d: InputEventScreenDrag = event
		pos = d.position
		dragged = true
	elif event is InputEventMouseButton:
		var m: InputEventMouseButton = event
		pos = m.position
		pressed = m.pressed and m.button_index == MOUSE_BUTTON_LEFT
		released = not m.pressed and m.button_index == MOUSE_BUTTON_LEFT
	elif event is InputEventMouseMotion:
		var mm: InputEventMouseMotion = event
		pos = mm.position
		dragged = Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	if dragged:
		casting.drag_cast(pos)
		return
	if released:
		tension.set_holding(false)
		casting.release_cast()
		return
	if not pressed:
		return
	var hit: String = _hit_button(pos)
	if hit != "":
		_handle_action(hit)
		return
	if scene == "fishing":
		if casting.phase == "result":
			casting.phase = "idle"
			result = {}
		elif casting.phase == "strike":
			if casting.hook_fish():
				tension.reset()
		elif casting.phase == "fight":
			tension.tap_reel()
			tension.set_holding(true)
		elif casting.phase == "idle":
			casting.start_cast(pos)


func _hit_button(pos: Vector2) -> String:
	for i in range(_hot.size() - 1, -1, -1):
		var b: Dictionary = _hot[i]
		if (b["rect"] as Rect2).has_point(pos):
			return String(b["id"])
	return ""


func _handle_action(id: String) -> void:
	if id == "noop":
		return
	if id.begins_with("lake:"):
		enter_lake(id.substr(5))
	elif id == "workbench":
		scene = "workbench"
	elif id == "menu":
		scene = "menu"
	elif id == "back":
		scene = "fishing" if not lake.is_empty() else "menu"
	elif id == "drone":
		if drone.use():
			drone.mark(fish)
			set_msg("Drone up — species, depth & cover revealed for 5s", 2.0)
		else:
			set_msg("Drone recharging — %ds" % int(ceil(drone.cool_t)), 1.5)
	elif id == "reelin":
		casting.reel_in()
	elif id.begins_with("buy:"):
		var parts: PackedStringArray = id.split(":")
		var r: Dictionary = Workbench.buy(save, parts[1], parts[2])
		if r["ok"]:
			SaveManager.persist(save)
			set_msg("Printed! Equipped.", 2.0)
		else:
			set_msg("Can't buy: " + String(r["why"]) + ".", 2.0)
	elif id.begins_with("equip:"):
		var p2: PackedStringArray = id.split(":")
		if Workbench.equip(save, p2[1], p2[2]):
			SaveManager.persist(save)


# ---------------- Drawing ----------------
func _draw() -> void:
	_hot = []
	if scene == "menu":
		_draw_menu()
	elif scene == "workbench":
		_draw_workbench()
	else:
		_draw_fishing()


func _text(pos: Vector2, text: String, size: int, color: Color, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_CENTER) -> void:
	draw_string(_font, pos, text, align, -1.0, size, color)


func _button(id: String, rect: Rect2, label: String, color: Color = Color("#1f6f54")) -> void:
	_hot.append({"id": id, "rect": rect})
	draw_rect(rect, color, true)
	draw_rect(rect, Color(1, 1, 1, 0.35), false, 2.0)
	_text(rect.get_center(), label, 26, Color.WHITE)


func _draw_menu() -> void:
	draw_rect(Rect2(0, 0, W, H), Color("#12303f"), true)
	_text(Vector2(W / 2, 180), "MICHIGAN", 58, Color.WHITE)
	_text(Vector2(W / 2, 250), "LUNKER RUSH", 64, Color("#ffd94d"))
	_text(Vector2(W / 2, 300), "Pick a lake. Cast. Fight the fish. Print better lures.", 22, Color("#cfe8f7"))
	_text(Vector2(40, 350), "Coins: %d" % int(save["coins"]), 30, Color("#ffd94d"), HORIZONTAL_ALIGNMENT_LEFT)
	_text(Vector2(W - 40, 350), "Caught: %d fish" % int(save["totalCaught"]), 30, Color.WHITE, HORIZONTAL_ALIGNMENT_RIGHT)
	# Retention hook, on the menu where it answers "one more cast?".
	_text(Vector2(40, 384), "Best bass: %.1f lb      Best pike: %.1f lb" % [float((save["best"] as Dictionary).get("largemouth", 0.0)), float((save["best"] as Dictionary).get("pike", 0.0))], 22, Color("#cfe8f7"), HORIZONTAL_ALIGNMENT_LEFT)
	var daily: Dictionary = save.get("daily", {})
	if not daily.is_empty():
		var done_mark: String = "✓ DONE" if bool(daily.get("done", false)) else "— +%d coins" % int(daily.get("bonus", 50))
		_text(Vector2(40, 412), "Today: land a %s over %.1f lb  %s" % [String(daily.get("name", "")), float(daily.get("min_weight", 0.0)), done_mark], 22, Color("#ffd94d"), HORIZONTAL_ALIGNMENT_LEFT)
	var y := 448.0
	for lake_id in LakesData.LAKES.keys():
		var lk: Dictionary = LakesData.LAKES[lake_id]
		var rect := Rect2(50, y, W - 100, 170)
		_hot.append({"id": "lake:" + lake_id, "rect": rect})
		draw_rect(rect, Color(0.08, 0.24, 0.31, 0.9), true)
		draw_rect(rect, Color(1, 1, 1, 0.3), false, 2.0)
		_text(Vector2(76, y + 34), "★ " + String(lk["tag"]), 15, Color("#ffd94d"), HORIZONTAL_ALIGNMENT_LEFT)
		_text(Vector2(76, y + 78), String(lk["name"]), 34, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT)
		_text(Vector2(76, y + 116), String(lk["desc"]), 22, Color("#cfe8f7"), HORIZONTAL_ALIGNMENT_LEFT)
		y += 196.0
	_button("workbench", Rect2(50, y + 6, W - 100, 84), "WORKBENCH — 3D PRINTER")


func _draw_fishing() -> void:
	# Sky + water.
	draw_rect(Rect2(0, 0, W, WATER_TOP), Color("#8ec9ee"), true)
	draw_rect(Rect2(0, WATER_TOP, W, WATER_BOT - WATER_TOP), Color("#2e7d6b"), true)
	draw_rect(Rect2(0, WATER_BOT, W, H - WATER_BOT), Color("#0b1c2c"), true)
	# HUD.
	draw_rect(Rect2(0, 0, W, 86), Color(0.03, 0.09, 0.15, 0.92), true)
	_text(Vector2(20, 56), "Coins: %d" % int(save["coins"]), 30, Color("#ffd94d"), HORIZONTAL_ALIGNMENT_LEFT)
	_text(Vector2(W / 2, 56), String(lake["name"]), 30, Color.WHITE)
	_text(Vector2(W - 20, 56), String(weather.current["name"]), 30, Color.WHITE, HORIZONTAL_ALIGNMENT_RIGHT)
	# Drone button.
	var dlabel: String = "SCOUT DRONE"
	if drone.active:
		dlabel = "DRONE ON %ds" % int(ceil(drone.reveal_t))
	elif drone.cool_t > 0.0:
		dlabel = "DRONE %ds" % int(ceil(drone.cool_t))
	_button("drone", Rect2(W - 236, 100, 212, 62), dlabel, Color("#3a6ea5"))
	# Revealed fish — species, size, depth and cover. Casting near one
	# bites 2.5x faster, so the reveal tells you where to cast.
	if drone.active:
		for f in fish:
			var pos: Vector2 = f["pos"]
			var length: float = 26.0 + float(f["weight"]) * 2.2
			var gold: bool = bool(f.get("gold", false))
			draw_circle(pos, length * 0.5, Color(0.85, 0.68, 0.15, 0.9) if gold else Color(0.02, 0.08, 0.11, 0.85))
			_text(Vector2(pos.x, pos.y - 22), ("★ GOLD " if gold else "") + String(f["species"]["name"]), 17, Color("#ffd94d") if gold else Color.WHITE)
			_text(Vector2(pos.x, pos.y + 34), "%.1f lb" % float(f["weight"]), 17, Color.WHITE)
			var depth: Dictionary = f.get("depth", {})
			_text(Vector2(pos.x, pos.y + 54), "%s · %d ft · %s" % [String(depth.get("label", "")), int(depth.get("ft", 0)), String(f.get("cover", ""))], 15, Color("#9fd8b6"))
	# First-trip teaching, no tutorial card: the first fish feeds in plain
	# sight and the game points at it. Gone after the first catch.
	if int(save["totalCaught"]) == 0 and casting.phase == "idle" and not fish.is_empty():
		var first: Dictionary = fish[0]
		var fp: Vector2 = first["pos"]
		draw_arc(fp, 44.0 + 8.0 * sin(time * 3.0), 0.0, TAU, 48, Color(1, 1, 1, 0.7), 2.0)
		_text(Vector2(W / 2, WATER_TOP - 40), "A fish is feeding right there — drag on the water to cast at it", 22, Color.WHITE)
	# Bobber.
	if casting.phase == "waiting" or casting.phase == "strike" or casting.phase == "fight":
		draw_circle(casting.bobber, 11.0, Color("#e33"))
		draw_circle(casting.bobber + Vector2(0, -3), 7.0, Color.WHITE)
		if casting.phase == "strike":
			_text(Vector2(W / 2, WATER_TOP + 120), "STRIKE!", 44, Color("#ffdf3d"))
	# Casting aim.
	if casting.phase == "aiming":
		draw_line(Vector2(360, 1160), casting.drag_pos, Color(1, 1, 1, 0.8), 2.0)
		_text(Vector2(360, 1050), "CAST POWER %d%%" % int(casting.power * 100.0), 18, Color.WHITE)
	# Tension bar — wide, thumb-side, with a visible danger zone.
	if casting.phase == "fight":
		var line: Dictionary = LakesData.LINES[save["equippedLine"]]
		var bx := 636.0
		var by := 340.0
		var bh := 540.0
		var cap: float = float(line["capacity"])
		var frac: float = tension.tension / cap
		draw_rect(Rect2(bx - 8, by - 8, 66, bh + 16), Color(0, 0, 0, 0.55), true)
		# Amber band: the top 20% below the snap line — the danger zone.
		var cap_y: float = by + bh - (cap / 200.0) * bh
		var warn_y: float = by + bh - (cap * 0.8 / 200.0) * bh
		draw_rect(Rect2(bx, cap_y, 50, warn_y - cap_y), Color(1, 0.69, 0.13, 0.30), true)
		var th: float = (tension.tension / 200.0) * bh
		var fill: Color = Color("#39d353") if frac < 0.5 else (Color("#ffb020") if frac < 0.8 else Color("#ff3b30"))
		draw_rect(Rect2(bx, by + bh - th, 50, th), fill, true)
		draw_line(Vector2(bx - 8, cap_y), Vector2(bx + 58, cap_y), Color("#ffdf3d"), 3.0)
		_text(Vector2(bx + 25, by - 22), "TENSION", 18, Color.WHITE)
		if frac >= 0.8:
			var blink: Color = Color("#ff3b30") if int(time * 4.0) % 2 == 0 else Color.WHITE
			_text(Vector2(bx + 25, by - 48), "DANGER", 24, blink)
		draw_rect(Rect2(40, WATER_TOP + 14, W - 140, 26), Color(0, 0, 0, 0.55), true)
		draw_rect(Rect2(44, WATER_TOP + 18, (W - 148) * (tension.progress / 100.0), 18), Color("#39c6ff"), true)
		_text(Vector2(W / 2 - 30, WATER_TOP + 66),
			"%s  •  %.1f lb" % [String(casting.hooked["species"]["name"]), float(casting.hooked["weight"])], 18, Color.WHITE)
		if tension.escape > 35.0:
			_text(Vector2(W / 2, WATER_BOT - 60), "SLACK! TAP TO STAY TIGHT", 30, Color("#ff3b30"))
		_text(Vector2(W / 2, WATER_BOT - 28), "TAP = reel in  •  HOLD = reel hard (tension!)  •  idle = fish spits hook", 18, Color("#cfe8f7"))
	# Bottom bar — all primary controls within bottom-thumb reach (one-handed portrait).
	draw_rect(Rect2(0, 1150, W, 130), Color(0.03, 0.09, 0.15, 0.92), true)
	_button("workbench", Rect2(24, 1176, 200, 76), "Workbench")
	_button("menu", Rect2(248, 1176, 140, 76), "Lakes")
	if casting.phase == "waiting" or casting.phase == "strike":
		_button("reelin", Rect2(412, 1176, 140, 76), "Reel In")
	if casting.phase == "idle":
		_text(Vector2(580, 1216), "Drag on the water to cast", 22, Color("#cfe8f7"))
	# Toast message.
	if msg_t > 0.0 and msg != "":
		draw_rect(Rect2(60, 96, W - 120, 52), Color(0, 0, 0, 0.6), true)
		_text(Vector2(W / 2, 132), msg, 24, Color.WHITE)
	# Result card.
	if casting.phase == "result" and not result.is_empty():
		draw_rect(Rect2(0, 0, W, H), Color(0, 0, 0, 0.62), true)
		draw_rect(Rect2(90, 420, W - 180, 420), Color("#10222f"), true)
		_text(Vector2(W / 2, 520), String(result["title"]), 40, Color("#ffd94d"))
		_text(Vector2(W / 2, 580), String(result["sub"]), 26, Color.WHITE)
		if int(result["coins"]) > 0:
			_text(Vector2(W / 2, 660), "+%d coins" % int(result["coins"]), 44, Color("#ffd94d"))
		if String(result.get("note", "")) != "":
			_text(Vector2(W / 2, 700), String(result["note"]), 24, Color("#7cfc9a"))
		_text(Vector2(W / 2, 740), "Tap anywhere to keep fishing", 22, Color("#cfe8f7"))


func _draw_workbench() -> void:
	draw_rect(Rect2(0, 0, W, H), Color("#10222f"), true)
	_text(Vector2(W / 2, 90), "WORKBENCH", 44, Color.WHITE)
	_text(Vector2(W / 2, 130), "3D-printer PLA lures & upgraded line — saved on this device", 22, Color("#cfe8f7"))
	_text(Vector2(40, 190), "Coins: %d" % int(save["coins"]), 32, Color("#ffd94d"), HORIZONTAL_ALIGNMENT_LEFT)
	var y := 220.0
	_text(Vector2(40, y), "LURES  (printed PLA)", 26, Color("#9fd8b6"), HORIZONTAL_ALIGNMENT_LEFT)
	y += 16.0
	for lure_id in LakesData.LURES.keys():
		var lure: Dictionary = LakesData.LURES[lure_id]
		var owned: bool = (save["lures"] as Dictionary).has(lure_id)
		var equipped: bool = String(save["equippedLure"]) == lure_id
		draw_rect(Rect2(40, y, W - 80, 118), Color(1, 1, 1, 0.07), true)
		_text(Vector2(60, y + 38), String(lure["name"]) + ("  ★ EQUIPPED" if equipped else ""), 26, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT)
		var label: String = "EQUIPPED" if equipped else ("EQUIP" if owned else "BUY %d" % int(lure["cost"]))
		var bid: String = "noop" if equipped else (("equip:lure:" + lure_id) if owned else ("buy:lure:" + lure_id))
		_button(bid, Rect2(W - 220, y + 22, 160, 72), label)
		y += 134.0
	y += 10.0
	_text(Vector2(40, y), "LINE  (tension capacity)", 26, Color("#9fd8b6"), HORIZONTAL_ALIGNMENT_LEFT)
	y += 16.0
	for line_id in LakesData.LINES.keys():
		var ln: Dictionary = LakesData.LINES[line_id]
		var owned2: bool = (save["lines"] as Dictionary).has(line_id)
		var equipped2: bool = String(save["equippedLine"]) == line_id
		draw_rect(Rect2(40, y, W - 80, 118), Color(1, 1, 1, 0.07), true)
		_text(Vector2(60, y + 38), String(ln["name"]) + ("  ★ EQUIPPED" if equipped2 else ""), 26, Color.WHITE, HORIZONTAL_ALIGNMENT_LEFT)
		_text(Vector2(60, y + 70), "Snap at %d tension" % int(ln["capacity"]), 20, Color("#cfe8f7"), HORIZONTAL_ALIGNMENT_LEFT)
		var label2: String = "EQUIPPED" if equipped2 else ("EQUIP" if owned2 else "BUY %d" % int(ln["cost"]))
		var bid2: String = "noop" if equipped2 else (("equip:line:" + line_id) if owned2 else ("buy:line:" + line_id))
		_button(bid2, Rect2(W - 220, y + 22, 160, 72), label2)
		y += 134.0
	_button("back", Rect2(40, 1160, W - 80, 76), "← BACK TO THE WATER")
