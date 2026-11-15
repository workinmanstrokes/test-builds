class_name CardData
extends Resource
## One trading card. All sets, players and creatures are original
## parody content — no real athletes, teams, or copyrighted characters.

const RARITY_COLORS := {
	"common": Color("#9aa0a6"),
	"uncommon": Color("#3fb950"),
	"rare": Color("#4a90e2"),
	"ultra": Color("#a371f7"),
	"secret": Color("#f2b705"),
}
const RARITY_BASE := {
	"common": Vector2i(2, 8),
	"uncommon": Vector2i(8, 25),
	"rare": Vector2i(25, 80),
	"ultra": Vector2i(80, 250),
	"secret": Vector2i(250, 800),
}
const RARITY_WEIGHTS := {
	"common": 55, "uncommon": 25, "rare": 12, "ultra": 6, "secret": 2,
}

# Original parody sets. Format: set_key -> {name, pack_price, color, cards[]}
const SETS := {
	"gridiron": {
		"name": "Gridiron Legends", "pack_price": 30, "color": Color("#1f6f3f"),
		"cards": [
			["Brick Wallson", "Lineman · Metro Mammoths", "common", "🧱"],
			["Sammy Slants", "Wide Receiver · Bay Breakers", "common", "💨"],
			["Pete Punt", "Punter · Desert Vipers", "common", "🦶"],
			["Dash Okafor", "Running Back · Metro Mammoths", "uncommon", "⚡"],
			["Marty Blitz", "Linebacker · Ironwood Bears", "uncommon", "💥"],
			["Tank Ramirez", "Running Back · Bay Breakers", "rare", "🚛"],
			["Rocket Reeves", "Quarterback · Desert Vipers", "rare", "🚀"],
			["Blitz McCoy", "Quarterback · Metro Mammoths", "ultra", "🌩️"],
			["Gridiron Ghost", "Legendary QB · Hall of Fame", "secret", "👻"],
		],
	},
	"kaiju": {
		"name": "Pocket Kaiju", "pack_price": 25, "color": Color("#b3541e"),
		"cards": [
			["Bubble Turtle", "Water · Shell Bounce", "common", "🐢"],
			["Leaf Toad", "Grass · Croak Shot", "common", "🐸"],
			["Pebble Pup", "Rock · Rollout", "common", "🐶"],
			["Volt Mouse", "Electric · Static Cheeks", "uncommon", "🐭"],
			["Ember Newt", "Fire · Tail Cinder", "uncommon", "🦎"],
			["Aqua Serpent", "Water · Tidal Coil", "rare", "🐍"],
			["Storm Owl", "Flying · Thunder Hoot", "rare", "🦉"],
			["Inferno Lizard", "Fire · Magma Breath", "ultra", "🦖"],
			["Celestial Dragonet", "Dragon · Starfall", "secret", "🐉"],
		],
	},
	"mythic": {
		"name": "Mythic Marvels", "pack_price": 35, "color": Color("#5b3a8c"),
		"cards": [
			["Squire Bright", "Sidekick · Shiny Shield", "common", "🛡️"],
			["The Clockwork Imp", "Trickster · Gear Grin", "common", "⚙️"],
			["Storm Witch", "Sorceress · Lightning Loom", "uncommon", "🧙"],
			["Shadow Fox", "Rogue · Night Pounce", "uncommon", "🦊"],
			["Ironclad Knight", "Guardian · Bulwark Oath", "rare", "⚔️"],
			["Doctor Dimension", "Mystic · Portal Practice", "rare", "🌀"],
			["Captain Cosmos", "Hero · Star Spangled", "ultra", "🌟"],
			["The Silver Streak", "Speedster · Fastest Alive", "secret", "💫"],
		],
	},
}

@export var uid: int = 0
@export var set_key: String = ""
@export var set_name: String = ""
@export var card_name: String = ""
@export var title: String = ""
@export var rarity: String = "common"
@export var art: String = "🃏"
@export var base_value: int = 1
# Hidden physical condition — only revealed by inspecting at the desk.
@export var centering_lr: int = 50
@export var centering_tb: int = 50
@export var corners_whitened: Array[bool] = [false, false, false, false]
@export var edge_wear: int = 0
@export var surface_lines: int = 0
# Filled in by Grading.grade_card()
@export var graded: bool = false
@export var grade: int = 0
@export var grade_mult: float = 1.0
@export var slab_value: int = 0

static var _next_uid: int = 1

func value() -> int:
	return slab_value if graded else base_value

static func roll_rarity() -> String:
	var total := 0
	for r in RARITY_WEIGHTS:
		total += RARITY_WEIGHTS[r]
	var roll := randi_range(1, total)
	for r in RARITY_WEIGHTS:
		roll -= RARITY_WEIGHTS[r]
		if roll <= 0:
			return r
	return "common"

static func _pick_weighted(pairs: Array) -> Variant:
	var total := 0
	for p in pairs:
		total += p[1]
	var roll := randi_range(1, total)
	for p in pairs:
		roll -= p[1]
		if roll <= 0:
			return p[0]
	return pairs[pairs.size() - 1][0]

static func make_card(set_key: String, rarity: String) -> CardData:
	var set_data: Dictionary = SETS[set_key]
	var pool: Array = []
	for c in set_data["cards"]:
		if c[2] == rarity:
			pool.append(c)
	var def: Array = pool[randi_range(0, pool.size() - 1)] if not pool.is_empty() else set_data["cards"][randi_range(0, set_data["cards"].size() - 1)]
	var card := CardData.new()
	card.uid = _next_uid
	_next_uid += 1
	card.set_key = set_key
	card.set_name = set_data["name"]
	card.card_name = def[0]
	card.title = def[1]
	card.rarity = def[2]
	card.art = def[3]
	var lo: int = RARITY_BASE[def[2]].x
	var hi: int = RARITY_BASE[def[2]].y
	card.base_value = randi_range(lo, hi)
	# Hidden condition rolls
	var dev: int = _pick_weighted([[0, 25], [5, 35], [10, 22], [15, 12], [20, 6]])
	card.centering_lr = 50 + (dev if randf() < 0.5 else -dev)
	card.centering_tb = 50 + (dev if randf() < 0.5 else -dev)
	var white_count: int = _pick_weighted([[0, 30], [1, 32], [2, 22], [3, 11], [4, 5]])
	var order: Array = [0, 1, 2, 3]
	order.shuffle()
	for i in white_count:
		card.corners_whitened[order[i]] = true
	card.edge_wear = _pick_weighted([[0, 25], [1, 22], [2, 20], [3, 14], [4, 9], [5, 6], [6, 4]])
	card.surface_lines = _pick_weighted([[0, 35], [1, 28], [2, 20], [3, 10], [4, 7]])
	return card

static func open_pack(set_key: String) -> Array[CardData]:
	var cards: Array[CardData] = []
	for i in 4:
		cards.append(make_card(set_key, roll_rarity()))
	# Last card guaranteed Rare or better.
	cards.append(make_card(set_key, _pick_weighted([["rare", 55], ["ultra", 32], ["secret", 13]])))
	return cards
