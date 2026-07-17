"""Fetch OSM geometry for the Ramble bbox via Overpass API (plan §5.1)."""

import json
import os
import sys

import requests

import config

OVERPASS_QL = """
[out:json][timeout:60];
(
  way["highway"~"path|footway|steps"]({sw_lat},{sw_lon},{ne_lat},{ne_lon});
  way["natural"="water"]({sw_lat},{sw_lon},{ne_lat},{ne_lon});
  way["natural"="wood"]({sw_lat},{sw_lon},{ne_lat},{ne_lon});
  way["landuse"="grass"]({sw_lat},{sw_lon},{ne_lat},{ne_lon});
  way["leisure"~"park|garden"]({sw_lat},{sw_lon},{ne_lat},{ne_lon});
  way["bridge"="yes"]({sw_lat},{sw_lon},{ne_lat},{ne_lon});
  way["barrier"~"fence|wall"]({sw_lat},{sw_lon},{ne_lat},{ne_lon});
);
out geom;
""".format(
    sw_lat=config.BBOX["sw_lat"],
    sw_lon=config.BBOX["sw_lon"],
    ne_lat=config.BBOX["ne_lat"],
    ne_lon=config.BBOX["ne_lon"],
)


def fetch():
    os.makedirs(config.CACHE_DIR, exist_ok=True)
    headers = {"User-Agent": config.USER_AGENT}
    try:
        resp = requests.post(
            config.OVERPASS_URL, data={"data": OVERPASS_QL}, headers=headers, timeout=90
        )
        resp.raise_for_status()
        payload = resp.json()
    except (requests.RequestException, ValueError) as exc:
        print(f"[fetch_osm] Overpass request failed: {exc!r}", file=sys.stderr)
        print(
            "[fetch_osm] Network access to overpass-api.de appears blocked. "
            "Leaving no cache file so build.py fails loudly instead of using stale/fake data.",
            file=sys.stderr,
        )
        return False

    elements = payload.get("elements", [])
    if not elements:
        print("[fetch_osm] Overpass returned zero elements for the bbox — not writing cache.", file=sys.stderr)
        return False

    with open(config.OSM_CACHE_FILE, "w") as f:
        json.dump(payload, f)

    print(f"[fetch_osm] cached {len(elements)} elements -> {config.OSM_CACHE_FILE}")
    return True


if __name__ == "__main__":
    ok = fetch()
    sys.exit(0 if ok else 1)
