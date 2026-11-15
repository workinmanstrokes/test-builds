class_name Grading
extends RefCounted
## Grade calculation: a 1-10 grade weighted directly from the card's
## hidden sub-grades. Gem Mint 10 = 5x value.

const GRADE_MULT := { 10: 5.0, 9: 3.0, 8: 2.0, 7: 1.5, 6: 1.2, 5: 1.0, 4: 0.7, 3: 0.5, 2: 0.4, 1: 0.3 }
const FEE := 25

static func centering_score(card: CardData) -> float:
	var dev: int = maxi(abs(card.centering_lr - 50), abs(card.centering_tb - 50))
	return maxf(1.0, 10.0 - dev / 2.5)

static func corners_score(card: CardData) -> float:
	var n := 0
	for w in card.corners_whitened:
		if w:
			n += 1
	return maxf(1.0, 10.0 - 2.5 * n)

static func edges_score(card: CardData) -> float:
	return maxf(1.0, 10.0 - card.edge_wear)

static func surface_score(card: CardData) -> float:
	return maxf(1.0, 10.0 - 2.0 * card.surface_lines)

## Returns {grade, subs, mult, value}. Also stamps the card as graded.
static func grade_card(card: CardData) -> Dictionary:
	var c := centering_score(card)
	var k := corners_score(card)
	var e := edges_score(card)
	var s := surface_score(card)
	var grade: int = clampi(int(round(0.30 * c + 0.25 * k + 0.20 * e + 0.25 * s)), 1, 10)
	var mult: float = GRADE_MULT[grade]
	card.graded = true
	card.grade = grade
	card.grade_mult = mult
	card.slab_value = maxi(1, int(round(card.base_value * mult)))
	return {
		"grade": grade,
		"subs": {"centering": c, "corners": k, "edges": e, "surface": s},
		"mult": mult,
		"value": card.slab_value,
	}
