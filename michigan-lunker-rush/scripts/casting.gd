class_name Casting
## Tap-and-drag casting + bobber + bite rolling.
## Phases: "idle" -> "aiming" -> "waiting" -> "strike" (hook -> fight, handled by TensionGame).
## Tester update (VEX): full-power cast in a 200 px thumb drag (was 260),
## first cast of a first trip bites fast so the loop completes in under
## 60 seconds, and casting near a drone-revealed fish bites 2.5x faster.
extends RefCounted

const WATER_TOP := 300.0
const WATER_BOT := 1020.0
# One-handed portrait: a short thumb drag must reach full power.
const DRAG_FULL_PX := 200.0

var phase: String = "idle"
var start_pos: Vector2 = Vector2.ZERO
var drag_pos: Vector2 = Vector2.ZERO
var power: float = 0.0
var bobber: Vector2 = Vector2.ZERO
var bobber_t: float = 0.0
var bite_timer: float = 0.0
var strike_timer: float = 0.0
var hooked: Dictionary = {}
# True until the first strike of the player's first trip: the first cast
# bites almost at once so the first loop lands in under 60 seconds.
var quick_bite: bool = false


func start_cast(pos: Vector2) -> bool:
	if phase != "idle":
		return false
	if pos.y < WATER_TOP or pos.y > WATER_BOT:
		return false
	phase = "aiming"
	start_pos = pos
	drag_pos = pos
	power = 0.0
	return true


func drag_cast(pos: Vector2) -> void:
	if phase != "aiming":
		return
	drag_pos = pos
	power = clampf(start_pos.distance_to(pos) / DRAG_FULL_PX, 0.0, 1.0)


func release_cast() -> bool:
	if phase != "aiming":
		return false
	var target: Vector2 = drag_pos + (drag_pos - start_pos) * 0.6
	target.x = clampf(target.x, 50.0, 670.0)
	target.y = clampf(target.y, WATER_TOP + 40.0, WATER_BOT - 40.0)
	bobber = target
	bobber_t = 0.0
	phase = "waiting"
	bite_timer = randf_range(0.8, 1.6) if quick_bite else randf_range(1.5, 4.5)
	return true


func reel_in() -> bool:
	if phase == "waiting" or phase == "strike":
		phase = "idle"
		bobber = Vector2.ZERO
		return true
	return false


## Bite rate for one fish. A drone-revealed fish ("revealed" set by
## ScoutDrone.mark) bites 2.5x faster — but only if the bobber actually
## landed near it, so the drone is a casting decision, not a free buff.
func _bite_rate(f: Dictionary, lure_id: String, weather: Dictionary) -> float:
	var revealed: bool = bool(f.get("revealed", false)) and f["pos"].distance_to(bobber) <= LakesData.REVEALED_RADIUS
	return LakesData.bite_rate(f["species"], lure_id, weather, revealed)


## Rolls for a bite each frame. Returns the hooked fish dict on a strike, else {}.
func update(delta: float, fish: Array, lure_id: String, weather: Dictionary) -> Dictionary:
	bobber_t += delta
	if phase == "strike":
		strike_timer -= delta
		if strike_timer <= 0.0:
			phase = "waiting"
			hooked = {}
			bite_timer = randf_range(1.0, 3.0)
			return {}
	if phase != "waiting":
		return {}
	bite_timer -= delta
	if bite_timer > 0.0:
		return {}
	var total_rate: float = 0.0
	for f in fish:
		total_rate += _bite_rate(f, lure_id, weather)
	if randf() < total_rate * delta:
		hooked = _pick_weighted(fish, lure_id, weather)
		phase = "strike"
		strike_timer = 1.25
		quick_bite = false
		return hooked
	bite_timer = 0.25
	return {}


func _pick_weighted(fish: Array, lure_id: String, weather: Dictionary) -> Dictionary:
	var total: float = 0.0
	for f in fish:
		total += _bite_rate(f, lure_id, weather)
	var roll: float = randf() * total
	for f in fish:
		roll -= _bite_rate(f, lure_id, weather)
		if roll <= 0.0:
			return f
	return fish[fish.size() - 1]


func hook_fish() -> bool:
	if phase != "strike":
		return false
	phase = "fight"
	return true
