import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
from pathlib import Path
import UnityPy

bundle_path = Path(
    r"C:\Program Files (x86)\Silver And Blood\SilverAndBlood\SilverAndBlood_Data\dragon2019\assets\Document\AllLanguageEN.unity3d"
)
env = UnityPy.load(bundle_path.read_bytes())

for obj in env.objects:
    if obj.type.name == "TextAsset":
        asset = obj.read()
        text = getattr(asset, "m_Script", "")
        print(f"Text length: {len(text)}", flush=True)

        for keyword in [
            "silver moonlight",
            "Tiny Scale",
            "Happy Shield",
            "Adusti",
            "scale shield",
            "Scale Shield",
        ]:
            idx = text.lower().find(keyword.lower())
            if idx >= 0:
                print(f"\n=== FOUND '{keyword}' at index {idx} ===", flush=True)
                chunk = text[max(0, idx - 300) : idx + 2000]
                out = []
                for c in chunk:
                    code = ord(c)
                    if code >= 32:
                        out.append(c)
                    elif code == 10:
                        out.append("\n")
                    else:
                        out.append(f"|{code:02x}|")
                print("".join(out), flush=True)
            else:
                print(f"'{keyword}' NOT FOUND", flush=True)
