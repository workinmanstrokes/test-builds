class_name Raid
extends RefCounted
## Roguelite stakes. A Raid wipes everything the current job earned
## (unbanked credits + the active implant) and NOTHING else: banked
## credits and unlocked 3D-printer blueprints always survive.

var reason: String = ""
var lost_credits: int = 0
var lost_implant: String = ""


## Runs the raid against the live run state held by Main.
## Returns a Raid describing what was lost.
static func trigger(p_state: GameState, p_reason: String, p_unbanked: int,
		p_implant: String) -> Raid:
	var r := Raid.new()
	r.reason = p_reason
	r.lost_credits = p_unbanked
	r.lost_implant = p_implant
	p_state.raids += 1
	p_state.save()
	return r
