class_name Main
extends Control
## Entry point / screen glue for the Godot version.
## The full playable implementation lives in the web build
## (index.html); this wires the same systems together in Godot:
## Economy (packs/selling/grading) + InspectionDesk + Auction + Tycoon
## (days, rent, Neon Sign upgrade, save/load).
##
## The loop, in order — nothing is skippable:
##   1. Buy a pack, pull a card, put it on the desk.
##   2. Inspect all 4 metrics (centering / corners / edges / surface).
##      Grading stays locked until 4/4 — the inspection result decides
##      whether the card is worth grading at all.
##   3. Preview grading (P): fee + grade range + slab value range,
##      exact once fully inspected. Then grade (G) or sell raw (S)
##      for the standing fixed offer.
##   4. Graded slabs go to the live auction (A); raw cards cannot.
##   5. End the day (E): $15 rent, then the day ticks. Save is
##      automatic after every money move.
## PC controls are in docs/controls.md.

@onready var economy: Economy = $Economy
@onready var auction: Auction = $Auction
@onready var desk: InspectionDesk = $DeskPanel/InspectionDesk
@onready var cash_label: Label = $UI/TopBar/CashLabel
@onready var message_label: Label = $UI/TopBar/MessageLabel
@onready var desk_status: Label = $DeskPanel/DeskStatus

var tycoon: Tycoon = null

func _ready() -> void:
	tycoon = Tycoon.new()
	add_child(tycoon)
	tycoon.day_changed.connect(_on_day_changed)
	economy.cash_changed.connect(_on_cash_changed)
	desk.metric_revealed.connect(_on_metric_revealed)
	desk.all_inspected.connect(_on_all_inspected)
	auction.chat_line.connect(_on_auction_chat)
	auction.finished.connect(_on_auction_finished)
	var loaded: Dictionary = tycoon.load_game(economy)
	if loaded["ok"]:
		message_label.text = "Save loaded — Day %d, %d cards in the shop." % [loaded["day"], loaded["cards"]]
	else:
		message_label.text = "Welcome to Slab House Tycoon — buy a pack to start."
	_on_cash_changed(economy.cash)

func _save() -> void:
	if tycoon != null:
		tycoon.save_game(economy)

## PC controls (locked first — see docs/controls.md).
## G grade · P grading preview · S sell raw · A auction · H hype ·
## Space gavel · E end day · N buy Neon Sign.
func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_G:
				_on_submit_grading_pressed()
			KEY_P:
				_on_preview_grading_pressed()
			KEY_S:
				_on_raw_sell_pressed()
			KEY_A:
				_on_start_auction_pressed()
			KEY_H:
				_on_hype_pressed()
			KEY_SPACE:
				_on_gavel_pressed()
			KEY_E:
				_on_end_day_pressed()
			KEY_N:
				_on_buy_neon_sign_pressed()

func _on_cash_changed(new_cash: int) -> void:
	if tycoon != null:
		cash_label.text = "Cash: $%d · Day %d" % [new_cash, tycoon.day]
	else:
		cash_label.text = "Cash: $%d" % new_cash

func _on_day_changed(_new_day: int) -> void:
	_on_cash_changed(economy.cash)

func _on_metric_revealed(metric: String) -> void:
	desk_status.text = "Revealed: %s (%d/4 metrics)" % [metric, desk.inspected_count()]
	if desk.inspected_count() == 4:
		desk_status.text += " — grading unlocked!"

func _on_all_inspected() -> void:
	message_label.text = "All 4 metrics inspected — press P to preview grading, G to submit!"

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
	_save()

# --- UI button hooks (connect in the editor or from _ready) ---
func _on_buy_pack_pressed(set_key: String) -> void:
	var r: Dictionary = economy.buy_pack(set_key)
	if r["ok"]:
		message_label.text = "Opened a pack — %d cards pulled!" % (r["cards"] as Array).size()
		if not (r["cards"] as Array).is_empty():
			desk.set_card((r["cards"] as Array)[0])
		_save()
	else:
		message_label.text = r["reason"]

func _on_preview_grading_pressed() -> void:
	if desk.card == null:
		return
	var p: Dictionary = economy.grading_preview(desk.card.uid, desk.inspected)
	if not p["ok"]:
		message_label.text = p["reason"]
		return
	if p["fully_inspected"]:
		message_label.text = "Grading preview: $%d fee — grade %d exactly, slab worth $%d." % [p["fee"], p["grade_min"], p["value_min"]]
	else:
		message_label.text = "Grading preview: $%d fee — grade %d–%d, slab worth $%d–$%d. Inspect all 4 metrics to pin it." % [p["fee"], p["grade_min"], p["grade_max"], p["value_min"], p["value_max"]]

func _on_submit_grading_pressed() -> void:
	if desk.card == null:
		return
	if desk.inspected_count() < 4:
		message_label.text = "Finish inspection first: %d/4 metrics — grading unlocks at 4/4." % desk.inspected_count()
		return
	var r: Dictionary = economy.submit_grading(desk.card.uid)
	if r["ok"]:
		var res: Dictionary = r["result"]
		message_label.text = "Slabbed! Grade %d (%.1fx) — worth $%d" % [res["grade"], res["mult"], res["value"]]
		_save()
	else:
		message_label.text = r["reason"]

func _on_raw_sell_pressed() -> void:
	if desk.card == null:
		return
	var r: Dictionary = economy.raw_sell(desk.card.uid)
	message_label.text = "Sold raw for $%d." % r["amount"] if r["ok"] else r["reason"]
	if r["ok"]:
		_save()

func _on_start_auction_pressed() -> void:
	if desk.card == null:
		return
	var r: Dictionary = auction.start_auction(desk.card)
	if r["ok"]:
		message_label.text = "Auction live for %s!" % desk.card.card_name
	else:
		message_label.text = r["reason"]

func _on_hype_pressed() -> void:
	if auction.card == null or auction.over:
		return
	auction.hype_chat()

func _on_gavel_pressed() -> void:
	if auction.card == null or auction.over:
		return
	auction.gavel_slam()

func _on_end_day_pressed() -> void:
	var r: Dictionary = tycoon.end_day(economy)
	if r["shortfall"] > 0:
		message_label.text = "Day %d — rent $%d due, paid $%d ($%d short). Cash: $%d." % [r["day"], r["rent_due"], r["rent_paid"], r["shortfall"], r["cash"]]
	else:
		message_label.text = "Day %d — rent $%d paid. Cash: $%d." % [r["day"], r["rent_due"], r["cash"]]
	_save()

func _on_buy_neon_sign_pressed() -> void:
	var r: Dictionary = tycoon.buy_upgrade(economy, "neon_sign")
	if r["ok"]:
		message_label.text = "Neon Sign installed — buyer demand +15% on every sale!"
		_save()
	else:
		message_label.text = r["reason"]
