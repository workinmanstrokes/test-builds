class_name ScoutDrone
## Scout Drone: reveals underwater fish silhouettes for 5s, 15s cooldown.
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


func update(delta: float) -> void:
	if reveal_t > 0.0:
		reveal_t -= delta
		if reveal_t <= 0.0:
			active = false
	if cool_t > 0.0:
		cool_t -= delta
