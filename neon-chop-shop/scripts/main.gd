extends Node2D
## Neon Chop Shop — Milestone 1-3 vertical slice (Godot 4 port).
## State machine: TITLE -> WORKBENCH -> SURGERY -> ICE -> RAID / JOBDONE.
## Mirrors index.html exactly: same screens, same numbers, same stakes.
## Rendering is _draw()-based so the project runs with zero scene setup
## beyond this script (see main.tscn). Mouse drag works on desktop;
## emulate_touch_from_mouse is on in project.godot for mobile testing.

enum Screen { TITLE, WORKBENCH, SURGERY, ICE, RAID, JOBDONE }

const W := 720.0
const H := 1280.0
const CYAN := Color("22d3ee")
const PINK := Color("e879f9")
const GREEN := Color("4ade80")
const GOLD := Color("fbbf24")
const RED := Color("ef4444")
const INK := Color("e2e8f0")
const DIM := Color("94a3b8")

var state: GameState
var screen: int = Screen.TITLE
var surgery: Surgery = null
var ice: IceBattler = null
var raid: Raid = null
var unbanked: int = 0
var log_lines: Array[String] = []
var job_done_title: String = ""
var job_done_lines: Array[String] = []
var show_howto: bool = false
var selected_card: int = -1

# drag state: {"kind": "implant"/"wire", "idx"/"color", "pos": Vector2}
var drag: Dictionary = {}
var clickables: Array = []   # {rect: Rect2, action: Callable, enabled: bool}
var draggables: Array = []   # {kind, idx/color, pos: Vector2, r: float, can: Callable}


func _ready() -> void:
	state = GameState.load()
	set_process_input(true)


func log_msg(msg: String) -> void:
	log_lines.append(msg)
	if log_lines.size() > 6:
		log_lines.pop_front()
	queue_redraw()


# ---------- flow ----------

func start_job() -> void:
	surgery = Surgery.new(state, state.jobs + 1)
	surgery.failed.connect(_on_surgery_failed)
	surgery.completed.connect(_on_surgery_completed)
	ice = null
	unbanked = 0
	selected_card = -1
	log_lines.clear()
	log_msg(">> New client on the table. Run diagnostics.")
	log_msg(">> Fault unknown. Slots: Optics / Neural Link / Reflex Booster.")
	screen = Screen.SURGERY
	queue_redraw()


func _on_surgery_failed(reason: String) -> void:
	_trigger_raid(reason)


func _on_surgery_completed(payout: int) -> void:
	unbanked += payout
	log_msg(">> SURGERY COMPLETE. Client pays %dcr." % payout)
	ice = IceBattler.new(state)
	ice.raid_triggered.connect(_on_ice_raid)
	ice.hack_completed.connect(_on_hack_completed)
	screen = Screen.ICE
	queue_redraw()


func _on_ice_raid(reason: String) -> void:
	_trigger_raid(reason)


func _on_hack_completed(stolen: int) -> void:
	unbanked += 250
	state.hacks += 1
	state.bank_credits(unbanked)
	unbanked = 0
	state.jobs += 1
	state.save()
	job_done_title = "HACK COMPLETE"
	job_done_lines = [
		"All 3 firewall nodes destroyed.",
		"Stolen tech banked. Job #%d closed." % state.jobs,
	]
	ice = null
	screen = Screen.JOBDONE
	queue_redraw()


func jack_out() -> void:
	if ice == null:
		return
	var kept := unbanked
	state.bank_credits(unbanked)
	unbanked = 0
	state.jobs += 1
	state.save()
	job_done_title = "JACKED OUT"
	job_done_lines = [
		"You slipped out before the Trace peaked.",
		"Kept %dcr of unbanked earnings. Credits banked." % kept,
		"Job #%d closed (partial)." % state.jobs,
	]
	ice = null
	screen = Screen.JOBDONE
	queue_redraw()


func _trigger_raid(reason: String) -> void:
	raid = Raid.trigger(state, reason, unbanked,
		surgery.implant_name if surgery else "")
	unbanked = 0
	surgery = null
	ice = null
	selected_card = -1
	screen = Screen.RAID
	queue_redraw()


func buy_blueprint(id: String) -> void:
	if state.buy_blueprint(id):
		log_msg(">> Blueprint unlocked — printed and filed. Survives raids.")


# ---------- input ----------

func _input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_try_begin_drag(event.position)
		else:
			_end_drag_or_tap(event.position)
	elif event is InputEventMouseMotion and not drag.is_empty():
		drag["pos"] = event.position
		queue_redraw()


func _try_begin_drag(pos: Vector2) -> void:
	for d in draggables:
		if pos.distance_to(d["pos"]) <= float(d["r"]) and bool(d["can"].call()):
			drag = d.duplicate()
			drag["pos"] = pos
			return


func _end_drag_or_tap(pos: Vector2) -> void:
	if not drag.is_empty():
		var d := drag
		drag = {}
		if d["kind"] == "implant" and surgery:
			var res: String = surgery.try_seat_implant(int(d["idx"]), pos)
			match res:
				"seated":
					log_msg(">> %s implant SNAPPED in." % surgery.implant_name)
				"wrong_slot":
					log_msg(">> Implant REJECTED by that slot. Heat +%d." % 12)
				"not_diagnosed":
					log_msg(">> Run diagnostics first.")
		elif d["kind"] == "wire" and surgery:
			var nodes := _wire_nodes()
			if surgery.try_connect_wire(String(d["color"]), pos, nodes[d["color"]]):
				log_msg(">> %s circuit connected." % String(d["color"]).to_upper())
			else:
				log_msg(">> %s wire missed its node." % String(d["color"]).to_upper())
		queue_redraw()
		return
	for i in range(clickables.size() - 1, -1, -1):
		var c: Dictionary = clickables[i]
		if bool(c["enabled"]) and Rect2(c["rect"]).has_point(pos):
			(c["action"] as Callable).call()
			return
	_screen_tap(pos)


func _screen_tap(pos: Vector2) -> void:
	if screen == Screen.ICE and ice:
		for i in ice.hand.size():
			if _card_rect(i, ice.hand.size()).has_point(pos):
				var card: Dictionary = ice.hand[i]
				if selected_card == i:
					if int(card["dmg"]) == 0:
						ice.play_card(i, -1)
					else:
						selected_card = -1
				else:
					selected_card = i
				queue_redraw()
				return
		if selected_card >= 0:
			var card: Dictionary = ice.hand[selected_card]
			if int(card["dmg"]) > 0:
				for n in ice.nodes.size():
					if pos.distance_to(_node_pos(n)) <= 92.0:
						ice.play_card(selected_card, n)
						selected_card = -1
						queue_redraw()
						return


# ---------- geometry helpers (mirror index.html) ----------

func _slot_pos(slot_id: String) -> Vector2:
	for s in Surgery.SLOTS:
		if String(s["id"]) == slot_id:
			return s["pos"]
	return Vector2.ZERO


func _implant_rect(i: int) -> Rect2:
	return Rect2(60 + i * 215, 730, 170, 90)


func _wire_starts() -> Dictionary:
	return { "red": Vector2(100, 880), "blue": Vector2(100, 935), "green": Vector2(100, 990) }


func _wire_nodes() -> Dictionary:
	return { "red": Vector2(620, 880), "blue": Vector2(620, 935), "green": Vector2(620, 990) }


func _card_rect(i: int, n: int) -> Rect2:
	var w := 150.0
	var h := 260.0
	var gap := 13.0
	var total := n * w + (n - 1) * gap
	var x0 := (W - total) / 2.0
	var lift := -34.0 if selected_card == i else 0.0
	return Rect2(x0 + i * (w + gap), 860 + lift, w, h)


func _node_pos(n: int) -> Vector2:
	return Vector2(140 + n * 220, 380)


# ---------- drawing ----------

func _font() -> Font:
	return ThemeDB.fallback_font


func _text(t: String, pos: Vector2, size: int, color: Color,
		align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_CENTER) -> void:
	var f := _font()
	var w := f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var x := pos.x
	if align == HORIZONTAL_ALIGNMENT_CENTER:
		x -= w / 2.0
	elif align == HORIZONTAL_ALIGNMENT_RIGHT:
		x -= w
	draw_string(f, Vector2(x, pos.y + size * 0.35), t, align, -1, size, color)


func _rr(rect: Rect2, r: float, fill: Color, border: Color, width: float = 2.0) -> void:
	draw_rect(rect, fill)
	draw_rect(rect, border, false, width)
	# (rounded corners omitted in this slice — rects read cleanly at this scale)


func _button(rect: Rect2, label: String, action: Callable,
		enabled: bool = true, active: bool = false) -> void:
	var fill := Color("12233d") if enabled else Color("1a1a26")
	if active:
		fill = Color("0e7490")
	_rr(rect, 10, fill, CYAN if enabled else Color("333333"))
	_text(label, rect.get_center(), 20, INK if enabled else Color("555555"))
	clickables.append({ "rect": rect, "action": action, "enabled": enabled })


func _bar(rect: Rect2, frac: float, fill: Color, label: String = "") -> void:
	draw_rect(rect, Color("111111"))
	if frac > 0.0:
		var inner := Rect2(rect.position, Vector2(maxf(8.0, rect.size.x * minf(1.0, frac)), rect.size.y))
		draw_rect(inner, fill)
	draw_rect(rect, Color("334155"), false, 1.0)
	if label != "":
		_text(label, rect.get_center(), 15, INK)


func _draw() -> void:
	clickables.clear()
	draggables.clear()
	match screen:
		Screen.TITLE: _draw_title()
		Screen.WORKBENCH: _draw_workbench()
		Screen.SURGERY: _draw_surgery()
		Screen.ICE: _draw_ice()
		Screen.RAID: _draw_raid()
		Screen.JOBDONE: _draw_jobdone()


func _draw_title() -> void:
	draw_rect(Rect2(0, 0, W, H), Color("07070f"))
	_text("NEON", Vector2(360, 210), 110, CYAN)
	_text("CHOP SHOP", Vector2(360, 320), 74, PINK)
	_text("cyber-surgery - ice hacking - one wrong wire = raid", Vector2(360, 400), 19, DIM)
	_text("BANKED  %dcr    -    JOBS %d    -    RAIDS %d" % [state.banked, state.jobs, state.raids],
		Vector2(360, 470), 20, GOLD)
	_text("3D-printer blueprints owned: %d / %d" % [state.blueprints.size(), GameState.BLUEPRINTS.size()],
		Vector2(360, 505), 18, GREEN)
	_button(Rect2(140, 570, 440, 88), "NEW JOB", start_job)
	_button(Rect2(140, 678, 440, 88), "WORKBENCH - 3D PRINTER", func(): screen = Screen.WORKBENCH; queue_redraw())
	_button(Rect2(140, 786, 440, 88), "HOW TO PLAY", func(): show_howto = true; queue_redraw())
	_text("Raid wipes unbanked credits + the active implant.", Vector2(360, 940), 16, DIM)
	_text("Blueprints are never lost.", Vector2(360, 972), 16, GREEN)
	if show_howto:
		_draw_howto()


func _draw_howto() -> void:
	_rr(Rect2(60, 180, 600, 880), 14, Color8(5, 8, 18, 247), CYAN)
	_text("HOW TO PLAY", Vector2(360, 230), 30, CYAN)
	var lines: Array[String] = [
		"PHASE 1 - SURGERY",
		"1. DIAGNOSE: the log names the faulty slot.",
		"2. Drag the matching implant onto that slot.",
		"   Wrong slot = +12 Heat and a rejection.",
		"3. Drag each colored wire to its matching node.",
		"4. OVERCLOCK: +50% payout, Heat gains x1.25.",
		"5. COMPLETE SURGERY. Heat 100% = RAID.",
		"",
		"PHASE 2 - ICE BATTLER",
		"Draw 4 cards a turn (RAM +3/turn, max 10).",
		"SPIKE 2RAM/3dmg - SPOOF 1RAM/2dmg, Trace-5",
		"CLOAK 2RAM/Trace-15 - OVERCHARGE 3RAM/6dmg, Trace+10",
		"Destroy all 3 ICE nodes to finish the hack.",
		"Trace +5/turn, +3 per live node. Trace 100% = RAID.",
		"JACK OUT any time to bank what you stole.",
		"",
		"RAID: unbanked credits + active implant are gone.",
		"Banked credits and blueprints ALWAYS survive.",
	]
	for i in lines.size():
		_text(lines[i], Vector2(92, 272 + i * 30), 17,
			PINK if lines[i].begins_with("PHASE") or lines[i].begins_with("RAID") else Color("cbd5e1"),
			HORIZONTAL_ALIGNMENT_LEFT)
	_button(Rect2(240, 980, 240, 64), "CLOSE", func(): show_howto = false; queue_redraw())


func _draw_workbench() -> void:
	draw_rect(Rect2(0, 0, W, H), Color("07070f"))
	_text("3D PRINTER - WORKBENCH", Vector2(360, 110), 30, GREEN)
	_text("Blueprints persist through raids. Buy with banked credits.", Vector2(360, 148), 17, DIM)
	for i in GameState.BLUEPRINTS.size():
		var bp: Dictionary = GameState.BLUEPRINTS[i]
		var y := 180 + i * 148
		var owned := state.has_blueprint(String(bp["id"]))
		_rr(Rect2(40, y, 640, 132), 14,
			Color8(20, 60, 35, 230) if owned else Color8(16, 20, 40, 235),
			GREEN if owned else Color("1e3a5f"))
		_text(String(bp["name"]), Vector2(64, y + 32), 24, GREEN if owned else INK, HORIZONTAL_ALIGNMENT_LEFT)
		_text(String(bp["desc"]), Vector2(64, y + 66), 17, DIM, HORIZONTAL_ALIGNMENT_LEFT)
		_text("OWNED" if owned else "%d cr" % int(bp["cost"]), Vector2(64, y + 100), 18,
			GREEN if owned else GOLD, HORIZONTAL_ALIGNMENT_LEFT)
		if not owned:
			var id := String(bp["id"])
			_button(Rect2(500, y + 40, 150, 56), "PRINT",
				func(): buy_blueprint(id), state.banked >= int(bp["cost"]))
	_button(Rect2(40, 1090, 640, 72), "BACK TO SHOP",
		func(): screen = Screen.TITLE; queue_redraw())
	_text("Banked: %dcr" % state.banked, Vector2(360, 1210), 18, GOLD)


func _draw_surgery() -> void:
	draw_rect(Rect2(0, 0, W, H), Color("07070f"))
	_text("JOB #%d  -  UNBANKED %dcr" % [surgery.job_num, unbanked], Vector2(40, 100), 19, GOLD, HORIZONTAL_ALIGNMENT_LEFT)
	_text("HEAT %d%%" % surgery.heat, Vector2(700, 100), 19, RED if surgery.heat >= 70 else Color("fb923c"), HORIZONTAL_ALIGNMENT_RIGHT)
	_bar(Rect2(40, 118, 640, 18), surgery.heat / 100.0, RED if surgery.heat >= 70 else Color("f97316"))
	# log
	_rr(Rect2(40, 150, 460, 112), 14, Color8(4, 8, 16, 242), Color("112233"))
	for i in mini(5, log_lines.size()):
		_text(log_lines[log_lines.size() - mini(5, log_lines.size()) + i],
			Vector2(54, 168 + i * 20), 14, Color("7dd3fc"), HORIZONTAL_ALIGNMENT_LEFT)
	_button(Rect2(520, 180, 140, 52), "DIAGNOSED" if surgery.diagnosed else "DIAGNOSE",
		func(): _diagnose(), not surgery.diagnosed)
	# body
	_rr(Rect2(40, 280, 640, 420), 14, Color8(10, 16, 32, 230), Color("1e3a5f"))
	draw_arc(Vector2(360, 400), 74, 0, TAU, 48, Color("2dd4bf"), 3.0)
	draw_rect(Rect2(288, 486, 144, 190), Color("2dd4bf"), false, 3.0)
	draw_line(Vector2(432, 520), Vector2(560, 600), Color("2dd4bf"), 3.0)
	draw_line(Vector2(560, 600), Vector2(590, 680), Color("2dd4bf"), 3.0)
	_text("CLIENT", Vector2(360, 320), 16, DIM)
	for s in Surgery.SLOTS:
		var pos: Vector2 = s["pos"]
		var faulty := surgery.diagnosed and String(s["id"]) == surgery.faulty_slot
		var seated := surgery.seated == String(s["id"])
		draw_circle(pos, float(s["r"]), Color(s["id"] == "optics" ? "22d3ee" : s["id"] == "neural" ? "e879f9" : "4ade80") if seated else Color8(10, 20, 40, 230))
		draw_arc(pos, float(s["r"]), 0, TAU, 48, RED if faulty else Color("22d3ee"), 5.0 if faulty else 2.0)
		_text(("OK " if seated else "") + String(s["name"]).to_upper(), pos, 14, Color("052e16") if seated else INK)
		if faulty and not seated:
			_text("FAULTY", pos + Vector2(0, -float(s["r"]) - 16), 15, RED)
	# implant tray
	_text("IMPLANT TRAY - drag the matching chip onto the faulty slot", Vector2(360, 716), 15, DIM)
	for i in Surgery.IMPLANTS.size():
		var imp: Dictionary = Surgery.IMPLANTS[i]
		var r := _implant_rect(i)
		var is_drag := not drag.is_empty() and drag.get("kind") == "implant" and int(drag.get("idx", -1)) == i
		var dimmed := surgery.seated != "" or not surgery.diagnosed
		var pos := (Vector2(drag["pos"]) - Vector2(85, 45)) if is_drag else r.position
		_rr(Rect2(pos, r.size), 12, Color8(30, 30, 44, 217) if dimmed else Color8(20, 30, 55, 242),
			Color(String(imp["slot"]) == "optics" ? "22d3ee" : String(imp["slot"]) == "neural" ? "e879f9" : "4ade80"))
		_text(String(imp["name"]), pos + Vector2(85, 32), 22, Color("666666") if dimmed else INK)
		if surgery.diagnosed and surgery.seated == "":
			draggables.append({ "kind": "implant", "idx": i,
				"pos": r.get_center(), "r": 70.0,
				"can": func(): return surgery.diagnosed and surgery.seated == "" })
	# wire panel
	if surgery.seated != "":
		_rr(Rect2(40, 850, 640, 170), 14, Color8(10, 16, 32, 230), Color("1e3a5f"))
		_text("CIRCUIT BOARD - drag each wire to its matching node", Vector2(360, 878), 15, DIM)
		var starts := _wire_starts()
		var nodes := _wire_nodes()
		var colors := ["red", "blue", "green"]
		var cols := { "red": RED, "blue": Color("3b82f6"), "green": GREEN }
		for c in colors:
			var sp: Vector2 = starts[c]
			var np: Vector2 = nodes[c]
			var done := bool(surgery.wires.get(c, false))
			var is_drag := not drag.is_empty() and drag.get("kind") == "wire" and String(drag.get("color", "")) == c
			draw_circle(np, 30, cols[c] if done else Color8(20, 26, 44, 242))
			draw_arc(np, 30, 0, TAU, 48, cols[c], 3.0)
			_text("OK" if done else "O", np, 22, Color("052e16") if done else cols[c])
			if done:
				draw_line(sp, np, cols[c], 6.0)
				draw_circle(sp, 16, cols[c])
			else:
				var dp: Vector2 = Vector2(drag["pos"]) if is_drag else sp
				draw_circle(dp, 20, cols[c])
				draw_arc(dp, 20, 0, TAU, 32, Color.WHITE, 2.0)
				draggables.append({ "kind": "wire", "color": c, "pos": sp, "r": 30.0,
					"can": func(): return surgery.seated != "" and not bool(surgery.wires.get(c, false)) })
	else:
		_text("Run diagnostics, then seat the matching implant.", Vector2(360, 930), 17, DIM)
	# bottom controls
	var wires_done := true
	for c in Surgery.WIRE_COLORS:
		if not bool(surgery.wires.get(c, false)):
			wires_done = false
	_button(Rect2(40, 1050, 300, 76), "OVERCLOCK: ON (+50% pay)" if surgery.overclock else "OVERCLOCK: OFF",
		func(): surgery.overclock = not surgery.overclock; queue_redraw(),
		true, surgery.overclock)
	_button(Rect2(380, 1050, 300, 76), "COMPLETE SURGERY",
		func(): _complete_surgery(), surgery.seated != "" and wires_done)
	_text("Payout on completion: %dcr   -   Heat %d%% - 100%% fails" % [surgery.payout(), surgery.heat],
		Vector2(360, 1160), 16, DIM)


func _diagnose() -> void:
	if surgery.diagnosed:
		return
	var name := surgery.diagnose()
	log_msg(">> DIAGNOSTIC COMPLETE: %s is FAULTY." % name.to_upper())
	log_msg(">> Seat the implant, then route all 3 circuits.")


func _complete_surgery() -> void:
	var pay := surgery.complete()
	if pay < 0:
		log_msg(">> Circuits incomplete.")
		return
	log_msg(">> SURGERY COMPLETE. Client pays %dcr." % pay)


func _draw_ice() -> void:
	draw_rect(Rect2(0, 0, W, H), Color("05050f"))
	_text("CYBERSPACE - TRACE", Vector2(40, 42), 20, PINK, HORIZONTAL_ALIGNMENT_LEFT)
	_text("TURN %d" % ice.turn, Vector2(W - 40, 42), 20, DIM, HORIZONTAL_ALIGNMENT_RIGHT)
	_bar(Rect2(40, 62, 640, 26), ice.trace / 100.0, RED if ice.trace >= 70 else Color("d946ef"),
		"TRACE %d%%" % ice.trace)
	_text("RAM %d/%d   -   STOLEN %dcr   -   UNBANKED %dcr" % [ice.ram, ice.ram_max, ice.stolen, unbanked],
		Vector2(360, 116), 18, GOLD)
	for n in ice.nodes.size():
		var node: Dictionary = ice.nodes[n]
		var p := _node_pos(n)
		var alive := bool(node["alive"])
		draw_circle(p, 92, Color8(80, 10, 40, 230) if alive else Color8(20, 40, 25, 230))
		draw_arc(p, 92, 0, TAU, 48, Color("f43f5e") if alive else GREEN, 3.0)
		if alive:
			_text(String(node["name"]), p + Vector2(0, -18), 19, Color("fda4af"))
			_text("HP %d/%d" % [int(node["hp"]), int(node["max"])], p + Vector2(0, 14), 20, Color.WHITE)
			_bar(Rect2(p.x - 62, p.y + 44, 124, 12), float(node["hp"]) / float(node["max"]), Color("f43f5e"))
		else:
			_text("DOWN", p + Vector2(0, -6), 20, GREEN)
			_text(String(node["name"]), p + Vector2(0, 22), 14, GREEN)
	var sel := selected_card >= 0 and selected_card < ice.hand.size()
	_text("Tap a card to select it. Destroy all 3 nodes to finish the hack." if not sel
		else "Card armed - tap a live ICE node (Cloak: tap again to run it).",
		Vector2(360, 540), 17, DIM)
	_rr(Rect2(40, 570, 640, 150), 14, Color8(4, 8, 16, 242), Color("112233"))
	for i in mini(5, log_lines.size()):
		_text(log_lines[log_lines.size() - mini(5, log_lines.size()) + i],
			Vector2(54, 588 + i * 20), 14, Color("7dd3fc"), HORIZONTAL_ALIGNMENT_LEFT)
	_text("END TURN: Trace +5, +3 per live node. RAM +3.", Vector2(360, 760), 15, DIM)
	for i in ice.hand.size():
		var card: Dictionary = ice.hand[i]
		var r := _card_rect(i, ice.hand.size())
		var is_sel := selected_card == i
		var afford := ice.ram >= int(card["cost"])
		_rr(r, 12, Color8(40, 60, 110, 247) if is_sel else Color8(16, 20, 44, 242),
			CYAN if is_sel else (Color("38bdf8") if afford else Color("334155")))
		_text(String(card["name"]), r.get_center() + Vector2(0, -88), 20, INK if afford else DIM)
		_text("%d RAM" % int(card["cost"]), r.get_center() + Vector2(0, -56), 17, GOLD if afford else DIM)
		_text("DMG %d" % int(card["dmg"]) if int(card["dmg"]) > 0 else "TRACE %d" % int(card["trace"]),
			r.get_center() + Vector2(0, 102), 17, RED if int(card["dmg"]) > 0 else GREEN)
	_button(Rect2(40, 1160, 300, 76), "END TURN",
		func(): ice.end_turn(); selected_card = -1; queue_redraw())
	_button(Rect2(380, 1160, 300, 76), "JACK OUT",
		func(): jack_out())


func _draw_raid() -> void:
	draw_rect(Rect2(0, 0, W, H), Color8(22, 4, 4))
	_text("RAID", Vector2(360, 260), 84, RED)
	_text(raid.reason, Vector2(360, 360), 20, Color("fca5a5"))
	_rr(Rect2(90, 430, 540, 380), 14, Color8(20, 6, 10, 242), Color("7f1d1d"))
	_text("SEIZED BY POLICE", Vector2(360, 480), 24, RED)
	_text("Unbanked credits lost:  %dcr" % raid.lost_credits, Vector2(360, 540), 21, Color("fca5a5"))
	_text("Active implant lost:  %s" % (raid.lost_implant if raid.lost_implant != "" else "none"),
		Vector2(360, 580), 21, Color("fca5a5"))
	_text("KEPT: banked %dcr" % state.banked, Vector2(360, 665), 21, GREEN)
	_text("KEPT: %d blueprints - the printer stash survived" % state.blueprints.size(),
		Vector2(360, 705), 18, GREEN)
	_text("Blueprints are never lost to a raid.", Vector2(360, 745), 17, DIM)
	_button(Rect2(160, 880, 400, 84), "RETURN TO SHOP",
		func(): screen = Screen.TITLE; raid = null; queue_redraw())


func _draw_jobdone() -> void:
	draw_rect(Rect2(0, 0, W, H), Color8(4, 20, 10))
	_text(job_done_title, Vector2(360, 300), 64, GREEN)
	for i in job_done_lines.size():
		_text(job_done_lines[i], Vector2(360, 420 + i * 44), 20, Color("cbd5e1"))
	_text("Banked: %dcr   -   Jobs done: %d" % [state.banked, state.jobs], Vector2(360, 620), 20, GOLD)
	_button(Rect2(160, 700, 400, 84), "BACK TO SHOP",
		func(): screen = Screen.TITLE; queue_redraw())
	_button(Rect2(160, 810, 400, 84), "NEXT JOB", start_job)
