#!/usr/bin/env python3

import csv
import json
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "sfia-8_en_220221.xlsx - Skills.csv"
LEVELS_PATH = ROOT / "sfia_levels.json"
OUT_PATH = ROOT / "sfia_ai_descriptions.json"


def load_levels():
	data = json.loads(LEVELS_PATH.read_text(encoding="utf-8"))
	levels = {int(l["level"]): l for l in data.get("levels", [])}
	return levels


def sentence(parts):
	return " ".join(p.strip() for p in parts if p and p.strip())


def gen_description(skill_name: str, code: str, category: str, subcategory: str, level: int, levels_meta: dict):
	meta = levels_meta.get(level, {})
	level_name = meta.get("level_name", "")
	level_label = f"Level {level}" + (f" ({level_name})" if level_name else "")

	context = ""
	if subcategory and category:
		context = f"in {subcategory} ({category})"
	elif category:
		context = f"in {category}"

	skill_ref = skill_name or code

	# Note: keep these as original prose (not copied SFIA text). They are deliberately generic but useful.
	if level == 1:
		body = sentence([
			f"Supports {skill_ref} activities {context} by following defined instructions and templates.",
			"Collects and records basic information accurately and escalates issues when they arise.",
		])
	elif level == 2:
		body = sentence([
			f"Assists with {skill_ref} work {context} by gathering inputs, organising information, and contributing to drafts.",
			"Works with guidance, checks understanding with peers, and helps keep tasks on track.",
		])
	elif level == 3:
		body = sentence([
			f"Applies established {skill_ref} techniques {context} to well-defined problems and delivers complete work products.",
			"Explains findings clearly, documents decisions, and adapts within agreed standards when needed.",
		])
	elif level == 4:
		body = sentence([
			f"Performs {skill_ref} activities {context} for complex or ambiguous situations, selecting appropriate methods and tailoring outputs.",
			"Provides guidance to others, assures quality, and coordinates stakeholders to reach practical outcomes.",
		])
	elif level == 5:
		body = sentence([
			f"Leads {skill_ref} practice {context}, plans and directs work, and advises stakeholders on approach, trade-offs, and priorities.",
			"Reviews deliverables for completeness and quality and helps establish consistent ways of working across teams.",
		])
	elif level == 6:
		body = sentence([
			f"Sets direction for {skill_ref} {context} at organisational level, shaping standards, governance, and long-term plans.",
			"Influences senior stakeholders, balances risk and value, and sponsors major improvements across multiple domains.",
		])
	else:  # level == 7
		body = sentence([
			f"Defines vision for {skill_ref} {context} across the enterprise or wider ecosystem, mobilising people and resources to deliver strategic change.",
			"Champions best practice, builds key relationships, and drives sustained capability development at scale.",
		])

	return f"AI created: {level_label}. {body}"


def main():
	levels_meta = load_levels()

	with CSV_PATH.open(newline="", encoding="utf-8") as f:
		reader = csv.DictReader(f)
		rows = list(reader)

	out = {
		"generated_at": date.today().isoformat(),
		"source_file": CSV_PATH.name,
		"descriptions": {},
	}

	for row in rows:
		code = (row.get("Code") or "").strip()
		if not code:
			continue
		skill_name = (row.get("Skill") or "").strip()
		category = (row.get("Category") or "").strip()
		subcategory = (row.get("Subcategory") or "").strip()

		missing = {}
		for level in range(1, 8):
			key = f"Level {level} description"
			desc = (row.get(key) or "").strip()
			if desc:
				continue
			missing[str(level)] = gen_description(skill_name, code, category, subcategory, level, levels_meta)

		if missing:
			out["descriptions"][code] = missing

	OUT_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
	print(f"Wrote {OUT_PATH} with {len(out['descriptions'])} skills containing missing level descriptions.")


if __name__ == "__main__":
	main()

