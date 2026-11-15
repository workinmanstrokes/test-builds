class_name LakesData
## Static game data: lakes, species, weather, lures, lines.
## Mirrors the HTML5 version in index.html exactly.

const LAKES := {
	"holloway": {
		"id": "holloway", "name": "Holloway Flats", "tag": "STARTER",
		"desc": "Panfish & largemouth bass",
		"species": [
			{"id": "bluegill", "name": "Bluegill", "min": 0.2, "max": 0.8, "bite": 0.10, "fight": 0.25, "coins": 8},
			{"id": "pumpkinseed", "name": "Pumpkinseed", "min": 0.2, "max": 0.7, "bite": 0.09, "fight": 0.25, "coins": 8},
			{"id": "largemouth", "name": "Largemouth Bass", "min": 1.0, "max": 5.0, "bite": 0.06, "fight": 0.55, "coins": 15},
		],
	},
	"stclair": {
		"id": "stclair", "name": "St. Clair Channels", "tag": "MID",
		"desc": "Smallmouth, largemouth & pike",
		"species": [
			{"id": "smallmouth", "name": "Smallmouth Bass", "min": 1.0, "max": 6.0, "bite": 0.06, "fight": 0.65, "coins": 16},
			{"id": "largemouth", "name": "Largemouth Bass", "min": 1.0, "max": 5.0, "bite": 0.05, "fight": 0.55, "coins": 15},
			{"id": "pike", "name": "Northern Pike", "min": 3.0, "max": 12.0, "bite": 0.04, "fight": 0.85, "coins": 20},
		],
	},
	"tahquamenon": {
		"id": "tahquamenon", "name": "Tahquamenon Deep", "tag": "TROPHY",
		"desc": "Trophy northern pike water",
		"species": [
			{"id": "pike", "name": "Northern Pike", "min": 5.0, "max": 20.0, "bite": 0.05, "fight": 0.95, "coins": 20},
			{"id": "walleye", "name": "Walleye", "min": 2.0, "max": 8.0, "bite": 0.05, "fight": 0.60, "coins": 18},
			{"id": "perch", "name": "Yellow Perch", "min": 0.3, "max": 1.2, "bite": 0.10, "fight": 0.30, "coins": 8},
		],
	},
}

const WEATHERS := {
	"sunny": {"id": "sunny", "name": "Sunny", "pike_mult": 1.0},
	"overcast": {"id": "overcast", "name": "Overcast", "pike_mult": 1.0},
	"rain": {"id": "rain", "name": "Rain", "pike_mult": 1.4}, # Rain: +40% pike bite & aggression
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
	"braid15": {"id": "braid15", "name": "15 lb Braid", "cost": 0, "capacity": 100.0, "gain": 1.00},
	"fluoro25": {"id": "fluoro25", "name": "25 lb Fluoro Leader", "cost": 200, "capacity": 125.0, "gain": 0.75},
	"braid40": {"id": "braid40", "name": "40 lb Heavy Braid", "cost": 400, "capacity": 155.0, "gain": 0.55},
}


static func lure_mult(lure_id: String, species_id: String) -> float:
	var lure: Dictionary = LURES.get(lure_id, {})
	var mult: Dictionary = lure.get("mult", {})
	return float(mult.get(species_id, 1.0))


static func bite_rate(species: Dictionary, lure_id: String, weather: Dictionary) -> float:
	var rate: float = float(species["bite"]) * lure_mult(lure_id, String(species["id"]))
	if String(species["id"]) == "pike":
		rate *= float(weather["pike_mult"])
	return rate
