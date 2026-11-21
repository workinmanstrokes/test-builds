class_name LakesData
## Static game data: lakes, species, weather, lures, lines.
## Mirrors the HTML5 version in index.html, plus the VEX tester update
## (2026-11-20): species fight profiles, drone reveal bonus, gold fish,
## daily target, depth/cover data. The HTML slice has not been ported yet.

const LAKES := {
	"holloway": {
		"id": "holloway", "name": "Holloway Flats", "tag": "STARTER",
		"desc": "Panfish & largemouth bass",
		"species": [
			{"id": "bluegill",   "name": "Bluegill",       "min": 0.2, "max": 0.8, "bite": 0.10, "fight": 0.25, "coins": 8},
			{"id": "pumpkinseed","name": "Pumpkinseed",    "min": 0.2, "max": 0.7, "bite": 0.09, "fight": 0.25, "coins": 8},
			{"id": "largemouth", "name": "Largemouth Bass","min": 1.0, "max": 5.0, "bite": 0.06, "fight": 0.55, "coins": 15},
		],
	},
	"stclair": {
		"id": "stclair", "name": "St. Clair Channels", "tag": "MID",
		"desc": "Smallmouth, largemouth & pike",
		"species": [
			{"id": "smallmouth", "name": "Smallmouth Bass", "min": 1.0, "max": 6.0, "bite": 0.06, "fight": 0.65, "coins": 16},
			{"id": "largemouth", "name": "Largemouth Bass", "min": 1.0, "max": 5.0, "bite": 0.05, "fight": 0.55, "coins": 15},
			{"id": "pike",       "name": "Northern Pike",   "min": 3.0, "max": 12.0, "bite": 0.04, "fight": 0.85, "coins": 20},
		],
	},
	"tahquamenon": {
		"id": "tahquamenon", "name": "Tahquamenon Deep", "tag": "TROPHY",
		"desc": "Trophy northern pike water",
		"species": [
			{"id": "pike",    "name": "Northern Pike",  "min": 5.0, "max": 20.0, "bite": 0.05, "fight": 0.95, "coins": 20},
			{"id": "walleye", "name": "Walleye",        "min": 2.0, "max": 8.0,  "bite": 0.05, "fight": 0.60, "coins": 18},
			{"id": "perch",   "name": "Yellow Perch",   "min": 0.3, "max": 1.2,  "bite": 0.10, "fight": 0.30, "coins": 8},
		],
	},
}


const WEATHERS := {
	"sunny":    {"id": "sunny",    "name": "Sunny",    "pike_mult": 1.0},
	"overcast": {"id": "overcast", "name": "Overcast", "pike_mult": 1.0},
	"rain":     {"id": "rain",     "name": "Rain",     "pike_mult": 1.4}, # Rain: +40% pike bite & aggression
}

# Lures: bite multiplier per species id. Cost in fish coins.
const LURES := {
	"senko": {"id": "senko", "name": "Texas-Rigged Senko", "cost": 0,
		"mult": {"largemouth": 1.6, "smallmouth": 1.6}},
	"frog": {"id": "frog", "name": "Topwater Frog", "cost": 150,
		"mult": {"pike": 1.8, "largemouth": 1.3, "smallmouth": 1.3}},
	"crank": {"id": "crank", "name": "Squarebill Crankbait", "cost": 300,
		"mult": {"pike": 1.5, "walleye": 1.6, "largemouth": 1.2, "smallmouth": 1.2}},
}

# Lines: tension capacity — bigger test forgives harder runs.
const LINES := {
	"braid15":  {"id": "braid15",  "name": "15 lb Braid",         "cost": 0,   "capacity": 100.0, "gain": 1.00},
	"fluoro25": {"id": "fluoro25", "name": "25 lb Fluoro Leader", "cost": 200, "capacity": 125.0, "gain": 0.75},
	"braid40":  {"id": "braid40",  "name": "40 lb Heavy Braid",   "cost": 400, "capacity": 155.0, "gain": 0.55},
}

# --- Tester update (VEX): drone-as-decision, retention, fight feel ---
# Casting within this distance of a drone-revealed fish bites this much faster.
const REVEALED_RADIUS := 150.0
const REVEALED_BITE_MULT := 2.5
# Rare gold fish: spawn chance per fish, coin multiplier when landed.
const GOLD_CHANCE := 0.04
const GOLD_COIN_MULT := 3.0
# Daily target: bonus coins for landing the day's named fish.
const DAILY_BONUS := 50


static func lure_mult(lure_id: String, species_id: String) -> float:
	var lure: Dictionary = LURES.get(lure_id, {})
	var mult: Dictionary = lure.get("mult", {})
	return float(mult.get(species_id, 1.0))


static func bite_rate(species: Dictionary, lure_id: String, weather: Dictionary, revealed: bool = false) -> float:
	var rate: float = float(species["bite"]) * lure_mult(lure_id, String(species["id"]))
	if String(species["id"]) == "pike":
		rate *= float(weather["pike_mult"])
	if revealed:
		rate *= REVEALED_BITE_MULT
	return rate


## How a species fights. surge = tension/sec while the fish runs,
## rest = tension/sec bled off while it rests, tap = progress per reel tap,
## run/rest ranges = how long runs and rests last. Panfish nibble in short
## weak runs, bass fight in bursts, pike make long powerful runs — same
## tension bar, a different fish.
static func fight_profile(species: Dictionary) -> Dictionary:
	match String(species["id"]):
		"bluegill", "pumpkinseed", "perch":
			return {"surge": 14.0, "rest": 10.0, "tap": 7.0, "run_min": 0.5, "run_max": 0.9, "rest_min": 1.2, "rest_max": 2.0}
		"largemouth":
			return {"surge": 24.0, "rest": 6.0, "tap": 5.0, "run_min": 0.6, "run_max": 1.1, "rest_min": 0.8, "rest_max": 1.4}
		"smallmouth":
			return {"surge": 28.0, "rest": 6.0, "tap": 5.0, "run_min": 0.6, "run_max": 1.1, "rest_min": 0.7, "rest_max": 1.3}
		"walleye":
			return {"surge": 26.0, "rest": 6.0, "tap": 5.0, "run_min": 0.7, "run_max": 1.2, "rest_min": 0.9, "rest_max": 1.5}
		"pike":
			return {"surge": 36.0, "rest": 4.0, "tap": 4.0, "run_min": 1.2, "run_max": 2.0, "rest_min": 0.6, "rest_max": 1.0}
	return {"surge": 20.0, "rest": 6.0, "tap": 5.0, "run_min": 0.6, "run_max": 1.2, "rest_min": 0.8, "rest_max": 1.5}


## Depth a species holds at — what the drone reveals.
static func roll_depth(species_id: String) -> Dictionary:
	match species_id:
		"bluegill", "pumpkinseed", "perch":
			return {"label": "SHALLOW", "ft": randi_range(3, 6)}
		"largemouth", "smallmouth", "walleye":
			return {"label": "MID", "ft": randi_range(6, 12)}
		_:
			return {"label": "DEEP", "ft": randi_range(10, 18)}


## Cover a fish is holding on — what the drone reveals.
static func roll_cover() -> String:
	var r: float = randf()
	if r < 0.45:
		return "OPEN"
	if r < 0.75:
		return "WEEDS"
	return "LOG"


## One named fish per calendar day, same for every player that day.
## today is "YYYY-MM-DD" (Time.get_date_string_from_system()).
static func daily_target(today: String) -> Dictionary:
	var pool: Array = [
		{"id": "largemouth", "name": "Largemouth Bass", "min_weight": 3.0},
		{"id": "pike", "name": "Northern Pike", "min_weight": 8.0},
	]
	var pick: Dictionary = pool[abs(hash(today)) % pool.size()]
	return {"date": today, "species": pick["id"], "name": pick["name"],
		"min_weight": pick["min_weight"], "bonus": DAILY_BONUS, "done": false}
