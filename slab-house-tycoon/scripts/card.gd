extends MeshInstance3D
## Slab House Tycoon — 3D card model: flip/rotate and foil/holo shader control.
## The card is a thin box; a ShaderMaterial with a rainbow holo sweep is
## applied on top so the face shimmers as the card turns. Drag with the
## mouse (or touch) to rotate; F or the Flip button flips it front/back.

const HOLO_SHADER := """
shader_type spatial;
render_mode blend_mix, specular_schlick_ggx;

uniform vec4 base_color : source_color = vec4(0.12, 0.14, 0.22, 1.0);
uniform float holo_strength = 0.8;
uniform float foil_brightness = 0.35;

varying vec3 local_pos;

void vertex() {
	local_pos = VERTEX;
}

vec3 rainbow(float t) {
	return vec3(
		0.5 + 0.5 * sin(6.2831 * (t + 0.0)),
		0.5 + 0.5 * sin(6.2831 * (t + 0.33)),
		0.5 + 0.5 * sin(6.2831 * (t + 0.66)));
}

void fragment() {
	float sweep = local_pos.x * 0.8 + local_pos.y * 0.6 + TIME * 0.15;
	vec3 holo = rainbow(fract(sweep));
	float edge = smoothstep(0.42, 0.5, abs(UV.x - 0.5)) + smoothstep(0.42, 0.5, abs(UV.y - 0.5));
	vec3 col = base_color.rgb + holo * holo_strength * edge;
	ALBEDO = col;
	METALLIC = 0.6;
	ROUGHNESS = 0.25;
	EMISSION = holo * holo_strength * edge * foil_brightness;
}
"""

var current_card: Dictionary = {}
var _flipped := false
var _target_rotation_y := 0.0
var _dragging := false
var _material: ShaderMaterial

func _ready() -> void:
	_material = ShaderMaterial.new()
	var shader := Shader.new()
	shader.code = HOLO_SHADER
	_material.shader = shader
	material_override = _material

func show_card(card: Dictionary) -> void:
	current_card = card
	var rarity := String(card.get("rarity", "Common"))
	# Rarer cards shimmer harder.
	_material.set_shader_parameter("holo_strength", {
		"Common": 0.35, "Uncommon": 0.5, "Rare": 0.8,
		"Ultra Rare": 1.1, "Secret Rare": 1.4,
	}.get(rarity, 0.5))
	# Tint the base color per set so the face reads at a glance.
	_material.set_shader_parameter("base_color", {
		"sports": Color(0.10, 0.22, 0.38),
		"anime": Color(0.38, 0.12, 0.30),
		"comic": Color(0.38, 0.28, 0.08),
	}.get(String(card.get("set", "sports")), Color(0.12, 0.14, 0.22)))

func flip() -> void:
	_flipped = not _flipped
	_target_rotation_y += PI

func _process(delta: float) -> void:
	rotation.y = lerp_angle(rotation.y, _target_rotation_y, minf(1.0, delta * 6.0))

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_dragging = event.pressed
	elif event is InputEventMouseMotion and _dragging:
		_target_rotation_y += event.relative.x * 0.01
		rotation.x = clampf(rotation.x + event.relative.y * 0.005, -0.6, 0.6)
