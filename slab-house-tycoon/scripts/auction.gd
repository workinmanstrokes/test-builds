class_name Auction
extends Node
## Single-player Whatnot-style live auction.
## 15-second countdown, Hype Chat button boosts bidder momentum,
## three AI bidders with distinct behaviour, manual Gavel Slam.
## A bid in the final 3 seconds adds 2 seconds (max 2 extensions).

signal ticked(time_left: float, bid: int, leader: String)
signal chat_line(who: String, text: String)
signal finished(winner: String, final_bid: int)

const DURATION := 15.0
const BIDDER_CAPS := {"whale": 2.5, "snipe": 1.8, "bargain": 1.2}
const BIDDER_NAMES := {"whale": "Whale 🐋", "snipe": "SnipeBot 🤖", "bargain": "BargainHunter 🤑"}

var card: CardData = null
var value: int = 0
var time_left: float = DURATION
var bid: int = 0
var leader: String = ""
var hype: int = 0
var over: bool = false
var extensions: int = 0
var winner: String = ""
var final_bid: int = 0
var _timer: float = 0.0

func start_auction(c: CardData) -> void:
	card = c
	value = c.value()
	bid = maxi(1, int(round(value * 0.5)))
	time_left = DURATION
	leader = ""
	hype = 0
	over = false
	extensions = 0
	winner = ""
	final_bid = 0
	chat_line.emit("📢", "Auction open for %s — starting at $%d!" % [c.card_name, bid])

func hype_chat() -> void:
	if over:
		return
	hype = mini(100, hype + 20)
	chat_line.emit("📣 YOU", "HYPE! Everybody in chat — this slab is MINT! 🔥")
	if randf() < 0.35 + hype / 250.0:
		var keys: Array = ["whale", "bargain", "snipe"]
		_try_bid(keys[randi_range(0, 2)], 0.08 + randf() * 0.08)

func gavel_slam() -> void:
	if not over:
		_finish()

func _try_bid(bidder: String, pct: float) -> bool:
	var cap: int = int(round(value * BIDDER_CAPS[bidder]))
	var next_bid: int = bid + maxi(1, int(round(bid * pct)))
	if next_bid > cap:
		return false
	bid = next_bid
	leader = bidder
	chat_line.emit(BIDDER_NAMES[bidder], "bids $%d!" % bid)
	if time_left <= 3.0 and extensions < 2:
		time_left += 2.0
		extensions += 1
		chat_line.emit("📢", "+2s! A late bid extends the clock.")
	return true

func _process(delta: float) -> void:
	if card == null or over:
		return
	_timer += delta
	if _timer < 0.25:
		return
	_timer = 0.0
	time_left = maxf(0.0, time_left - 0.25)
	var hype_boost: float = hype / 100.0
	# Whale: rare, huge jumps, loves hype.
	if randf() < 0.030 + hype_boost * 0.05:
		_try_bid("whale", 0.25 + randf() * 0.15)
	# BargainHunter: early small bids, walks away above 1.2x value.
	if time_left > 6.0 and randf() < 0.08 + hype_boost * 0.04:
		_try_bid("bargain", 0.05 + randf() * 0.03)
	# SnipeBot: silent until the last 4 seconds.
	if time_left <= 4.0 and time_left > 0.0 and randf() < 0.22 + hype_boost * 0.10:
		_try_bid("snipe", 0.10 + randf() * 0.05)
	if randf() < 0.02:
		var lines: Array = ["That centering is CLEAN 👀", "I would pay double for this",
			"My kid would love this one", "SnipeBot is lurking...", "HYPE! HYPE! HYPE!",
			"Slabbed and beautiful", "My wallet is scared"]
		chat_line.emit("💬 chat", lines[randi_range(0, lines.size() - 1)])
	ticked.emit(time_left, bid, leader)
	if time_left <= 0.0:
		_finish()

func _finish() -> void:
	over = true
	if leader != "":
		winner = leader
		final_bid = bid
		chat_line.emit("🔨", "SOLD to %s for $%d!" % [BIDDER_NAMES[leader], bid])
	else:
		chat_line.emit("🔨", "No bids — the card did not sell.")
	finished.emit(winner, final_bid)
