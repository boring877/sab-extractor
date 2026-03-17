import json

path = r'C:/Users/Borin/OneDrive/Documents/gacha-wiki/src/data/silver-and-blood/heirloom_stats.json'
s = json.load(open(path, 'r', encoding='utf-8'))
g = s['level_groups']

# 2002: add Lucille
g['2002']['heroes'].append({"hero_id": "20780", "name": "Lucille", "quality": "4"})

# 4001: add Resurgent Setti
g['4001']['heroes'].append({"hero_id": "20790", "name": "Resurgent Setti", "quality": "4"})

# 3003: add Transcendent Jestel
g['3003']['heroes'].append({"hero_id": "20810", "name": "Transcendent Jestel", "quality": "4"})

# 4003: Friedrich - add with raw captured 4110 data (only Lv0-6, non-standard scaling)
g['4003'] = {
    "property_group": "4110",
    "heroes": [{"hero_id": "20180", "name": "Friedrich", "quality": "4"}],
    "levels": [
        {"level": 0, "property_id": "4110000", "hp": 0, "atk": 0, "p_def": 0, "m_def": 0},
        {"level": 1, "property_id": "4110001", "hp": 1200, "atk": 60, "p_def": 30, "m_def": 30},
        {"level": 2, "property_id": "4110002", "hp": 2400, "atk": 120, "p_def": 60, "m_def": 60},
        {"level": 3, "property_id": "4110003", "hp": 3800, "atk": 190, "p_def": 95, "m_def": 95},
        {"level": 4, "property_id": "4110004", "hp": 5200, "atk": 260, "p_def": 130, "m_def": 130},
        {"level": 5, "property_id": "4110005", "hp": 6800, "atk": 340, "p_def": 170, "m_def": 170},
        {"level": 6, "property_id": "4110006", "hp": 8800, "atk": 440, "p_def": 220, "m_def": 220},
    ],
    "note": "Friedrich uses a different scaling system (property group 4110). Only captured up to Lv6. Lv6 is the max heirloom level for this character."
}

with open(path, 'w', encoding='utf-8') as f:
    json.dump(s, f, indent=2)

# Verify
total_heroes = sum(len(gg['heroes']) for gg in g.values())
print(f"Total heroes across all groups: {total_heroes}")
for gid in sorted(g.keys()):
    print(f"  {gid} ({g[gid]['property_group']}): {len(g[gid]['heroes'])} heroes - {[h['name'] for h in g[gid]['heroes']]}")
