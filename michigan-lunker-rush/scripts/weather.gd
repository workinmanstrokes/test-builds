class_name WeatherSystem
## Weather state machine. Rain boosts Northern Pike bite & aggression by 40%.
extends RefCounted

var current: Dictionary = LakesData.WEATHERS["sunny"]


func roll() -> Dictionary:
	var r: float = randf()
	if r < 0.45:
		current = LakesData.WEATHERS["sunny"]
	elif r < 0.80:
		current = LakesData.WEATHERS["overcast"]
	else:
		current = LakesData.WEATHERS["rain"]
	return current


func pike_mult() -> float:
	return float(current["pike_mult"])


func is_rain() -> bool:
	return String(current["id"]) == "rain"
