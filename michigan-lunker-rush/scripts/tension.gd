class_name TensionGame
## Vertical tension-bar fight.
## Tap = reel in (+progress, -tension). Hold = reel hard (+progress fast, +tension fast).
## No input = slack builds, fish spits the hook. Tension >= line capacity = snap.
## Tester update (VEX): the fight now runs on the hooked species' fight
## profile (LakesData.fight_profile) instead of one scalar — panfish nibble
## in short weak runs and reel in fast, bass fight in bursts, pike make
## long powerful runs that hold tension. Same bar, a different fish.
extends RefCounted

var progress: float = 0.0
var tension: float = 0.0
var escape: float = 0.0
var slack: float = 0.0
var holding: bool = false
var running: bool = false
var run_t: float = 0.0
# Fight profile of the currently hooked fish; {} until a fight starts.
var profile: Dictionary = {}


func reset() -> void:
	progress = 0.0
	tension = 0.0
	escape = 0.0
	slack = 0.0
	holding = false
	running = false
	profile = {}
	run_t = randf_range(0.8, 1.6)


func tap_reel() -> void:
	progress += float(profile.get("tap", 5.0))
	tension = maxf(0.0, tension - 3.0)
	slack = 0.0
	escape = maxf(0.0, escape - 30.0)


func set_holding(on: bool) -> void:
	holding = on


## Returns "" while the fight continues, else "caught" | "snap" | "spit".
func update(delta: float, hooked: Dictionary, line: Dictionary, weather: Dictionary) -> String:
	if profile.is_empty():
		profile = LakesData.fight_profile(hooked["species"])
	var surge: float = float(profile["surge"])
	if String(hooked["species"]["id"]) == "pike":
		surge *= float(weather["pike_mult"]) # Rain +40% pike aggression
	var gain: float = float(line["gain"])
	run_t -= delta
	if run_t <= 0.0:
		if running:
			running = false
			run_t = randf_range(float(profile["rest_min"]), float(profile["rest_max"]))
		else:
			running = true
			run_t = randf_range(float(profile["run_min"]), float(profile["run_max"]))
	if running:
		tension += surge * gain * delta
	else:
		tension = maxf(0.0, tension - float(profile["rest"]) * delta)
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
