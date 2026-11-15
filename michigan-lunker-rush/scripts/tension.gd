class_name TensionGame
## Vertical tension-bar fight.
## Tap = reel in (+progress, -tension). Hold = reel hard (+progress fast, +tension fast).
## No input = slack builds, fish spits the hook. Tension >= line capacity = snap.
extends RefCounted

var progress: float = 0.0
var tension: float = 0.0
var escape: float = 0.0
var slack: float = 0.0
var holding: bool = false
var running: bool = false
var run_t: float = 0.0


func reset() -> void:
	progress = 0.0
	tension = 0.0
	escape = 0.0
	slack = 0.0
	holding = false
	running = false
	run_t = randf_range(0.8, 1.6)


func tap_reel() -> void:
	progress += 5.0
	tension = maxf(0.0, tension - 3.0)
	slack = 0.0
	escape = maxf(0.0, escape - 30.0)


func set_holding(on: bool) -> void:
	holding = on


## Returns "" while the fight continues, else "caught" | "snap" | "spit".
func update(delta: float, hooked: Dictionary, line: Dictionary, weather: Dictionary) -> String:
	var aggression: float = float(hooked["species"]["fight"])
	if String(hooked["species"]["id"]) == "pike":
		aggression *= float(weather["pike_mult"]) # Rain +40% pike aggression
	var gain: float = float(line["gain"])
	run_t -= delta
	if run_t <= 0.0:
		if running:
			running = false
			run_t = randf_range(1.0, 2.2)
		else:
			running = true
			run_t = randf_range(0.6, 1.3)
	if running:
		tension += 26.0 * aggression * gain * delta
	else:
		tension = maxf(0.0, tension - 6.0 * delta)
	if holding:
		progress += 16.0 * delta
		tension += 28.0 * gain * delta
	slack += delta
	if slack > 1.5:
		escape += 22.0 * delta
	tension = clampf(tension, 0.0, 200.0)
	if tension >= float(line["capacity"]):
		return "snap"
	if escape >= 100.0:
		return "spit"
	if progress >= 100.0:
		return "caught"
	return ""
