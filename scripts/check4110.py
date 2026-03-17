import json
d=json.load(open(r'D:/Silverandblood/silver-and-blood-next/output/captured/CData_Property_20260317_192811.json','r',encoding='utf-8'))
cap4110=dict(sorted([(int(k)%10000, d['data'][k]) for k in d['data'] if k.startswith('4110')]))
for lv,e in sorted(cap4110.items()):
    print(f'4110 Lv{lv}: HP={e["m_MaxHp"]} ATK={e["m_Attack"]} PDEF={e["m_PhyDefence"]} MDEF={e["m_MagDefence"]}')
print(f'\nMax level in capture: {max(cap4110.keys())}')
