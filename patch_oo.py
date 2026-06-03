import json

with open("/etc/onlyoffice/documentserver/local.json") as f:
    data = json.load(f)

# Disable browser JWT requirement
data["services"]["CoAuthoring"]["token"]["enable"]["browser"] = False

with open("/etc/onlyoffice/documentserver/local.json", "w") as f:
    json.dump(data, f, indent=2)
print("Patched local.json")
