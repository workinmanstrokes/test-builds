class_name Economy
extends Node
## Shop economy: cash, inventory, pack buying, selling, grading.
## No F2P wait timers — everything is priced in cash only.

signal cash_changed(new_cash: int)
signal inventory_changed

const START_CASH := 500

var cash: int = START_CASH
var inventory: Array[CardData] = []
var stats := {"packs": 0, "graded": 0, "sold": 0, "auctions": 0, "earned": 0}

func buy_pack(set_key: String) -> Dictionary:
	if not CardData.SETS.has(set_key):
		return {"ok": false, "reason": "Unknown set."}
	var price: int = CardData.SETS[set_key]["pack_price"]
	if cash < price:
		return {"ok": false, "reason": "Not enough cash for a %s pack ($%d)." % [CardData.SETS[set_key]["name"], price]}
	cash -= price
	var cards: Array[CardData] = CardData.open_pack(set_key)
	inventory.append_array(cards)
	stats["packs"] += 1
	cash_changed.emit(cash)
	inventory_changed.emit()
	return {"ok": true, "cards": cards}

func find_card(uid: int) -> CardData:
	for c in inventory:
		if c.uid == uid:
			return c
	return null

func remove_card(uid: int) -> void:
	for i in inventory.size():
		if inventory[i].uid == uid:
			inventory.remove_at(i)
			inventory_changed.emit()
			return

func raw_sell(uid: int) -> Dictionary:
	var card := find_card(uid)
	if card == null:
		return {"ok": false, "reason": "Card not found."}
	if card.graded:
		return {"ok": false, "reason": "Already slabbed — sell it as a slab instead."}
	cash += card.base_value
	stats["sold"] += 1
	stats["earned"] += card.base_value
	remove_card(uid)
	cash_changed.emit(cash)
	return {"ok": true, "amount": card.base_value}

func submit_grading(uid: int) -> Dictionary:
	var card := find_card(uid)
	if card == null:
		return {"ok": false, "reason": "Card not found."}
	if card.graded:
		return {"ok": false, "reason": "Already graded."}
	if cash < Grading.FEE:
		return {"ok": false, "reason": "Need $%d for grading." % Grading.FEE}
	cash -= Grading.FEE
	var result: Dictionary = Grading.grade_card(card)
	stats["graded"] += 1
	cash_changed.emit(cash)
	inventory_changed.emit()
	return {"ok": true, "card": card, "result": result}

func sell_card(uid: int) -> Dictionary:
	var card := find_card(uid)
	if card == null:
		return {"ok": false, "reason": "Card not found."}
	var amount: int = card.value()
	cash += amount
	stats["sold"] += 1
	stats["earned"] += amount
	remove_card(uid)
	cash_changed.emit(cash)
	return {"ok": true, "amount": amount}

func slab_count() -> int:
	var n := 0
	for c in inventory:
		if c.graded:
			n += 1
	return n
