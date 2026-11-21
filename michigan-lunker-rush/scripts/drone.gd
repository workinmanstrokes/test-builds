class_name ScoutDrone
## Scout Drone: reveals underwater fish silhouettes for 5s, 15s cooldown.
## Tester update (VEX): the drone is now a fishing decision, not a viewer.
## While it is up it marks each fish "revealed" with its species, size,
## depth and cover (see Main._draw_fishing), and casting within 150 px of a
## revealed fish bites 2.5x faster (see Casting._bite_rate). Casting blind
## or at an unrevealed spot gets no bonus.
extends RefCounted

const REVEAL_SECONDS := 5.0
const COOLDOWN_SECONDS := 15.0

var active: bool = false
var reveal_t: float = 0.0
var cool_t: float = 0.0


func use() -> bool:
	if cool_t > 0.0:
		return false
	active = true
	reveal_t = REVEAL_SECONDS
	cool_t = COOLDOWN_SECONDS
	return true


## Mark every fish as revealed for as long as the drone is up.
func mark(fish: Array) -> void:
	for f in fish:
		f["revealed"] = true


func clear(fish: Array) -> void:
	for f in fish:
		f["revealed"] = false


func update(delta: float, fish: Array = []) -> void:
	if reveal_t > 0.0:
		reveal_t -= delta
		if reveal_t <= 0.0:
			active = false
			clear(fish)
	if cool_t > 0.0:
		cool_t -= delta
