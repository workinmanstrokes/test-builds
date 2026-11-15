extends Node2D
## Michigan Lunker Rush — Godot 4 controller (Milestone 1-3 vertical slice).
## Mirrors the HTML5 version in index.html: same lakes, weather, drone,
## casting, tension fight, workbench and save shape.

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


func enter_lake(lake_id: String) -> void:
	lake = LakesData.LAKES[lake_id]
	scene = "fishing"
	casting = Casting.new()
	tension = TensionGame.new()
	result = {}
	drone = ScoutDrone.new()
	weather.roll()
	_spawn_fish()
	set_msg(lake["name"] + " — " + str(weather.current["name"]), 2.5)


func _spawn_fish() -> void:
	fish = []
	var species_list: Array = lake["species"]
	for i in 6:
		var sp: Dictionary = species_list[randi() % species_list.size()]
		fish.append({
			"species": sp,
			"weight": randf_range(float(sp["min"]), float(sp["max"])),
			"pos": Vector2(randf_range(60.0, W - 60.0), randf_range(WATER_TOP + 60.0, WATER_BOT - 60.0)),
			"vx": randf_range(-14.0, 14.0),
		})


func set_msg(text: String, dur: float = 2.2) -> void:
	msg = text
	msg_t = dur


func _process(delta: float) -> void:
	time += delta
	if msg_t > 0.0:
		msg_t -= delta
	drone.update(delta)
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
		save["coins"] = int(save["coins"]) + coins
		save["totalCaught"] = int(save["totalCaught"]) + 1
		var caught: Dictionary = save["caught"]
		var sid: String = String(hooked["species"]["id"])
		caught[sid] = int(caught.get(sid, 0)) + 1
		var best: Dictionary = save["best"]
		if not best.has(sid) or float(hooked["weight"]) > float(best[sid]):
			best[sid] = snappedf(float(hooked["weight"]), 0.1)
		SaveManager.persist(save)
		result = {"kind": "caught",
			"title": ("TROPHY! " if is_trophy else "") + String(hooked["species"]["name"]),
			"sub": "%.1f lb landed" % float(hooked["weight"]), "coins": coins}
		# Landed fish leaves; a new one swims in.
		fish.erase(hooked)
		var species_list: Array = lake["species"]
		var sp: Dictionary = species_list[randi() % species_list.size()]
		fish.append({"species": sp, "weight": randf_range(float(sp["min"]), float(sp["max"])),
			"pos": Vector2(randf_range(60.0, W - 60.0), randf_range(WATER_TOP + 60.0, WATER_BOT - 60.0)),
			"vx": randf_range(-14.0, 14.0)})
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
			set_msg("Scout Drone up — fish revealed for 5s", 2.0)
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
	var y := 400.0
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
	# Revealed fish.
	if drone.active:
		for f in fish:
			var pos: Vector2 = f["pos"]
			var length: float = 26.0 + float(f["weight"]) * 2.2
			draw_circle(pos, length * 0.5, Color(0.02, 0.08, 0.11, 0.85))
			_text(Vector2(pos.x, pos.y - 22), String(f["species"]["name"]), 17, Color.WHITE)
			_text(Vector2(pos.x, pos.y + 34), "%.1f lb" % float(f["weight"]), 17, Color.WHITE)
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
	# Tension bar.
	if casting.phase == "fight":
		var line: Dictionary = LakesData.LINES[save["equippedLine"]]
		var bx := 648.0
		var by := 340.0
		var bh := 540.0
		draw_rect(Rect2(bx - 8, by - 8, 58, bh + 16), Color(0, 0, 0, 0.55), true)
		var th: float = (tension.tension / 200.0) * bh
		draw_rect(Rect2(bx, by + bh - th, 42, th), Color("#ff3b30") if tension.tension > 70.0 else Color("#39d353"), true)
		var cap_y: float = by + bh - (float(line["capacity"]) / 200.0) * bh
		draw_line(Vector2(bx - 8, cap_y), Vector2(bx + 50, cap_y), Color("#ffdf3d"), 3.0)
		_text(Vector2(bx + 21, by - 22), "TENSION", 18, Color.WHITE)
		draw_rect(Rect2(40, WATER_TOP + 14, W - 140, 26), Color(0, 0, 0, 0.55), true)
		draw_rect(Rect2(44, WATER_TOP + 18, (W - 148) * (tension.progress / 100.0), 18), Color("#39c6ff"), true)
		_text(Vector2(W / 2 - 30, WATER_TOP + 66),
			"%s  •  %.1f lb" % [String(casting.hooked["species"]["name"]), float(casting.hooked["weight"])], 18, Color.WHITE)
		if tension.escape > 35.0:
			_text(Vector2(W / 2, WATER_BOT - 60), "SLACK! TAP TO STAY TIGHT", 30, Color("#ff3b30"))
		_text(Vector2(W / 2, WATER_BOT - 28), "TAP = reel in  •  HOLD = reel hard (tension!)  •  idle = fish spits hook", 18, Color("#cfe8f7"))
	# Bottom bar.
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
