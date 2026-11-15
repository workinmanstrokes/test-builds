class_name InspectionDesk
extends Control
## Interactive Inspection Desk.
## Drag the loupe (magnifier) over the card:
##   - corners -> whitening check per corner
##   - edges   -> wear check per edge
##   - border  -> front centering numbers (e.g. 55/45)
##   - face    -> surface print lines, but only when the light is
##                tilted past +/-25 degrees (tiltable light shader)
## All 4 metrics must be revealed before grading unlocks.

signal metric_revealed(metric: String)
signal all_inspected

const CARD_RECT := Rect2(90, 70, 250, 350)
const LOUPE_RADIUS := 85.0
const CORNER_ZONE := 46.0
const EDGE_ZONE := 12.0
const LIGHT_THRESHOLD := 25.0

var card: CardData = null
var light_angle: float = 0.0
var loupe_pos := Vector2(CARD_RECT.get_center())
var loupe_active := false
var inspected := {"centering": false, "corners": false, "edges": false, "surface": false}
var corner_seen: Array[bool] = [false, false, false, false]
var edge_seen := {"top": false, "bottom": false, "left": false, "right": false}

func set_card(c: CardData) -> void:
	card = c
	inspected = {"centering": false, "corners": false, "edges": false, "surface": false}
	corner_seen = [false, false, false, false]
	edge_seen = {"top": false, "bottom": false, "left": false, "right": false}
	loupe_pos = CARD_RECT.get_center()
	queue_redraw()

func inspected_count() -> int:
	var n := 0
	for k in inspected:
		if inspected[k]:
			n += 1
	return n

func zone_at(p: Vector2) -> String:
	if not CARD_RECT.has_point(p):
		return ""
	var rel := p - CARD_RECT.position
	if rel.x < CORNER_ZONE and rel.y < CORNER_ZONE:
		return "corner-0"
	if rel.x > CARD_RECT.size.x - CORNER_ZONE and rel.y < CORNER_ZONE:
		return "corner-1"
	if rel.x < CORNER_ZONE and rel.y > CARD_RECT.size.y - CORNER_ZONE:
		return "corner-2"
	if rel.x > CARD_RECT.size.x - CORNER_ZONE and rel.y > CARD_RECT.size.y - CORNER_ZONE:
		return "corner-3"
	if rel.y < EDGE_ZONE:
		return "edge-top"
	if rel.y > CARD_RECT.size.y - EDGE_ZONE:
		return "edge-bottom"
	if rel.x < EDGE_ZONE:
		return "edge-left"
	if rel.x > CARD_RECT.size.x - EDGE_ZONE:
		return "edge-right"
	if rel.x < 30 or rel.x > CARD_RECT.size.x - 30 or rel.y < 30 or rel.y > CARD_RECT.size.y - 30:
		return "border"
	return "face"

func inspect_at(p: Vector2) -> void:
	if card == null:
		return
	var z := zone_at(p)
	if z == "":
		return
	if z.begins_with("corner-"):
		var i: int = int(z.split("-")[1])
		if not corner_seen[i]:
			corner_seen[i] = true
			if corner_seen.all(func(b): return b):
				inspected["corners"] = true
				metric_revealed.emit("corners")
				_check_all()
	elif z.begins_with("edge-"):
		var e: String = z.split("-")[1]
		if not edge_seen[e]:
			edge_seen[e] = true
			var all := true
			for k in edge_seen:
				if not edge_seen[k]:
					all = false
			if all:
				inspected["edges"] = true
				metric_revealed.emit("edges")
				_check_all()
	elif z == "border":
		if not inspected["centering"]:
			inspected["centering"] = true
			metric_revealed.emit("centering")
			_check_all()
	elif z == "face":
		if absf(light_angle) > LIGHT_THRESHOLD and not inspected["surface"]:
			inspected["surface"] = true
			metric_revealed.emit("surface")
			_check_all()

func _check_all() -> void:
	if inspected_count() == 4:
		all_inspected.emit()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		loupe_active = event.pressed
		if loupe_active:
			loupe_pos = event.position
			inspect_at(event.position)
			queue_redraw()
	elif event is InputEventMouseMotion and loupe_active:
		loupe_pos = event.position
		inspect_at(event.position)
		queue_redraw()

func _draw() -> void:
	# Felt table
	draw_rect(Rect2(20, 20, size.x - 40, size.y - 40), Color("#17351f"), true)
	if card == null:
		draw_string(ThemeDB.fallback_font, Vector2(40, size.y / 2),
			"No card on the desk.", HORIZONTAL_ALIGNMENT_CENTER, -1, 20, Color("#9aa3b2"))
		return
	_draw_card(CARD_RECT, false)
	# Light sheen
	var sheen := Color(1, 1, 1, absf(light_angle) / 60.0 * 0.22)
	draw_rect(CARD_RECT, sheen, true)
	# Loupe ring
	draw_arc(loupe_pos, LOUPE_RADIUS, 0, TAU, 48, Color("#f2b705"), 4.0)
	draw_line(loupe_pos + Vector2(-10, 0), loupe_pos + Vector2(10, 0), Color(1, 0.85, 0.2, 0.7), 2.0)
	draw_line(loupe_pos + Vector2(0, -10), loupe_pos + Vector2(0, 10), Color(1, 0.85, 0.2, 0.7), 2.0)

func _draw_card(r: Rect2, _detail: bool) -> void:
	var set_color: Color = CardData.SETS[card.set_key]["color"]
	draw_rect(r, set_color, true)
	draw_rect(Rect2(r.position + Vector2(12, 12), r.size - Vector2(24, 24)), Color("#f5f1e6"), true)
	draw_rect(Rect2(r.position + Vector2(22, 22), Vector2(r.size.x - 44, r.size.y * 0.52)), set_color, true)
	var font := ThemeDB.fallback_font
	draw_string(font, r.position + Vector2(20, r.size.y * 0.62), card.card_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("#14161c"))
	draw_string(font, r.position + Vector2(20, r.size.y * 0.72), card.title, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color("#444a56"))
	draw_string(font, r.position + Vector2(20, r.size.y * 0.82), card.rarity.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 14, CardData.RARITY_COLORS[card.rarity])
