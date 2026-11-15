class_name Main
extends Control
## Entry point / screen glue for the Godot version.
## The full playable implementation lives in the web build
## (index.html); this wires the same systems together in Godot:
## Economy (packs/selling/grading) + InspectionDesk + Auction.

@onready var economy: Economy = $Economy
@onready var auction: Auction = $Auction
@onready var desk: InspectionDesk = $DeskPanel/InspectionDesk
@onready var cash_label: Label = $UI/TopBar/CashLabel
@onready var message_label: Label = $UI/TopBar/MessageLabel
@onready var desk_status: Label = $DeskPanel/DeskStatus

func _ready() -> void:
	economy.cash_changed.connect(_on_cash_changed)
	desk.metric_revealed.connect(_on_metric_revealed)
	desk.all_inspected.connect(_on_all_inspected)
	auction.chat_line.connect(_on_auction_chat)
	auction.finished.connect(_on_auction_finished)
	_on_cash_changed(economy.cash)
	message_label.text = "Welcome to Slab House Tycoon — buy a pack to start."

func _on_cash_changed(new_cash: int) -> void:
	cash_label.text = "Cash: $%d" % new_cash

func _on_metric_revealed(metric: String) -> void:
	desk_status.text = "Revealed: %s (%d/4 metrics)" % [metric, desk.inspected_count()]
	if desk.inspected_count() == 4:
		desk_status.text += " — grading unlocked!"

func _on_all_inspected() -> void:
	message_label.text = "All 4 metrics inspected — submit for grading!"

func _on_auction_chat(who: String, text: String) -> void:
	print("[auction] %s: %s" % [who, text])

func _on_auction_finished(winner: String, final_bid: int) -> void:
	if winner != "":
		var card: CardData = auction.card
		economy.cash += final_bid
		economy.stats["auctions"] += 1
		economy.stats["earned"] += final_bid
		economy.remove_card(card.uid)
		message_label.text = "SOLD to %s for $%d!" % [Auction.BIDDER_NAMES[winner], final_bid]
	else:
		message_label.text = "Auction ended with no bids — card returned."

# --- UI button hooks (connect in the editor or from _ready) ---
func _on_buy_pack_pressed(set_key: String) -> void:
	var r: Dictionary = economy.buy_pack(set_key)
	if r["ok"]:
		message_label.text = "Opened a pack — %d cards pulled!" % (r["cards"] as Array).size()
		if not (r["cards"] as Array).is_empty():
			desk.set_card((r["cards"] as Array)[0])
	else:
		message_label.text = r["reason"]

func _on_submit_grading_pressed() -> void:
	if desk.card == null:
		return
	var r: Dictionary = economy.submit_grading(desk.card.uid)
	if r["ok"]:
		var res: Dictionary = r["result"]
		message_label.text = "Slabbed! Grade %d (%.1fx) — worth $%d" % [res["grade"], res["mult"], res["value"]]
	else:
		message_label.text = r["reason"]

func _on_raw_sell_pressed() -> void:
	if desk.card == null:
		return
	var r: Dictionary = economy.raw_sell(desk.card.uid)
	message_label.text = "Sold raw for $%d." % r["amount"] if r["ok"] else r["reason"]

func _on_start_auction_pressed() -> void:
	if desk.card == null:
		return
	auction.start_auction(desk.card)
	message_label.text = "Auction live for %s!" % desk.card.card_name

func _on_hype_pressed() -> void:
	auction.hype_chat()

func _on_gavel_pressed() -> void:
	auction.gavel_slam()
