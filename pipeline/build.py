"""Combine cached OSM + iNaturalist data into data/ramble_map.json and data/species.json.

Plan reference: ramble-implementation-plan.md §5.
"""

import json
import math
import os
import sys

from shapely.geometry import LineString, Point, Polygon
from shapely.prepared import prep

import config

TILE_CLASS_TO_GID = {
    "lawn": 1,
    "water": 2,
    "woodland": 3,
    "path": 4,
    "boundary": 5,
    "rock": 6,
}

TILE_CLASS_WALKABLE = {
    "lawn": True,
    "water": False,
    "woodland": True,
    "path": True,
    "boundary": False,
    "rock": False,
}

PATH_BUFFER_M = 0.9
BOUNDARY_BUFFER_M = 0.4


def project(lat, lon):
    """Equirectangular approximation, valid at the ~400m scale of the bbox (plan §5.1 step 1)."""
    x = (lon - config.ORIGIN_LON) * math.cos(math.radians(config.ORIGIN_LAT)) * 111320
    y = (lat - config.ORIGIN_LAT) * 110540
    return x, y


def load_osm_elements():
    if not os.path.exists(config.OSM_CACHE_FILE):
        print(f"[build] missing {config.OSM_CACHE_FILE} — run fetch_osm.py first.", file=sys.stderr)
        sys.exit(1)
    with open(config.OSM_CACHE_FILE) as f:
        payload = json.load(f)
    return payload["elements"]


def classify(tags):
    if tags.get("natural") == "water":
        return "water", "polygon"
    if tags.get("natural") == "wood":
        return "woodland", "polygon"
    if tags.get("landuse") == "grass" or tags.get("leisure") in ("park", "garden"):
        return "lawn", "polygon"
    if tags.get("highway") in ("path", "footway", "steps", "pedestrian"):
        return "path", "line"
    if "barrier" in tags:
        return "boundary", "line"
    return None, None


def element_to_geometry(element, shape_kind):
    coords = [project(pt["lat"], pt["lon"]) for pt in element.get("geometry", []) if pt]
    if len(coords) < 2:
        return None
    if shape_kind == "polygon":
        if coords[0] != coords[-1]:
            coords = coords + [coords[0]]
        if len(coords) < 4:
            return None
        try:
            poly = Polygon(coords)
            if not poly.is_valid:
                poly = poly.buffer(0)
            return poly if not poly.is_empty else None
        except Exception:
            return None
    else:
        try:
            line = LineString(coords)
            buf = PATH_BUFFER_M if shape_kind != "boundary_line" else BOUNDARY_BUFFER_M
            return line.buffer(buf)
        except Exception:
            return None


def build_grid_bounds():
    sw_x, sw_y = project(config.BBOX["sw_lat"], config.BBOX["sw_lon"])
    ne_x, ne_y = project(config.BBOX["ne_lat"], config.BBOX["ne_lon"])
    xmin, xmax = sw_x, ne_x
    ymin, ymax = sw_y, ne_y
    width = math.ceil((xmax - xmin) / config.GRID_METERS_PER_TILE)
    height = math.ceil((ymax - ymin) / config.GRID_METERS_PER_TILE)
    return xmin, xmax, ymin, ymax, width, height


def tile_center(col, row, xmin, ymax):
    x = xmin + (col + 0.5) * config.GRID_METERS_PER_TILE
    y = ymax - (row + 0.5) * config.GRID_METERS_PER_TILE
    return x, y


def paint_class(grid, width, height, xmin, ymax, geom, tile_class):
    minx, miny, maxx, maxy = geom.bounds
    col_lo = max(0, int((minx - xmin) / config.GRID_METERS_PER_TILE) - 1)
    col_hi = min(width - 1, int((maxx - xmin) / config.GRID_METERS_PER_TILE) + 1)
    row_lo = max(0, int((ymax - maxy) / config.GRID_METERS_PER_TILE) - 1)
    row_hi = min(height - 1, int((ymax - miny) / config.GRID_METERS_PER_TILE) + 1)
    if col_lo > col_hi or row_lo > row_hi:
        return
    prepared = prep(geom)
    for row in range(row_lo, row_hi + 1):
        for col in range(col_lo, col_hi + 1):
            cx, cy = tile_center(col, row, xmin, ymax)
            if prepared.contains(Point(cx, cy)):
                grid[row][col] = tile_class


def rasterize(elements):
    xmin, xmax, ymin, ymax, width, height = build_grid_bounds()
    grid = [[None for _ in range(width)] for _ in range(height)]

    by_class = {"boundary": [], "lawn": [], "woodland": [], "path": [], "water": []}
    for element in elements:
        if element.get("type") != "way":
            continue
        tags = element.get("tags", {})
        tile_class, shape_kind = classify(tags)
        if tile_class is None:
            continue
        if tile_class == "boundary":
            geom = element_to_geometry(element, "boundary_line")
        else:
            geom = element_to_geometry(element, shape_kind)
        if geom is not None and not geom.is_empty:
            by_class[tile_class].append(geom)

    paint_order = ["boundary", "lawn", "woodland", "path", "water"]
    counts = {}
    for tile_class in paint_order:
        for geom in by_class[tile_class]:
            paint_class(grid, width, height, xmin, ymax, geom, tile_class)
        counts[tile_class] = sum(row.count(tile_class) for row in grid)

    fallback_count = 0
    for row in grid:
        for col in range(width):
            if row[col] is None:
                row[col] = "lawn"
                fallback_count += 1

    counts["lawn"] += fallback_count
    return grid, width, height, counts, fallback_count


def build_tiled_json(grid, width, height):
    gids = [TILE_CLASS_TO_GID[cell] for row in grid for cell in row]

    tile_defs = []
    for tile_class, gid in sorted(TILE_CLASS_TO_GID.items(), key=lambda kv: kv[1]):
        tile_defs.append({
            "id": gid - 1,
            "properties": [
                {"name": "tile_class", "type": "string", "value": tile_class},
                {"name": "walkable", "type": "bool", "value": TILE_CLASS_WALKABLE[tile_class]},
                {"name": "habitat_tag", "type": "string", "value": tile_class},
            ],
        })

    tileset = {
        "columns": len(TILE_CLASS_TO_GID),
        "firstgid": 1,
        "image": "placeholder.png",
        "imageheight": config.TILE_SIZE_PX,
        "imagewidth": config.TILE_SIZE_PX * len(TILE_CLASS_TO_GID),
        "margin": 0,
        "name": "ramble_placeholder",
        "spacing": 0,
        "tilecount": len(TILE_CLASS_TO_GID),
        "tileheight": config.TILE_SIZE_PX,
        "tilewidth": config.TILE_SIZE_PX,
        "tiles": tile_defs,
    }

    layer = {
        "data": gids,
        "height": height,
        "id": 1,
        "name": "ground",
        "opacity": 1,
        "type": "tilelayer",
        "visible": True,
        "width": width,
        "x": 0,
        "y": 0,
    }

    return {
        "compressionlevel": -1,
        "height": height,
        "infinite": False,
        "layers": [layer],
        "nextlayerid": 2,
        "nextobjectid": 1,
        "orientation": "orthogonal",
        "renderorder": "right-down",
        "tiledversion": "1.10.2",
        "tileheight": config.TILE_SIZE_PX,
        "tilesets": [tileset],
        "tilewidth": config.TILE_SIZE_PX,
        "type": "map",
        "version": "1.10",
        "width": width,
    }


CURATED_SPECIES = [
    {"taxon_id": 46017, "id": "eastern_gray_squirrel", "common_name": "Eastern Gray Squirrel",
     "habitat_tags": ["lawn", "woodland", "path"], "time_of_day": ["dawn", "day", "dusk"],
     "rarity": "common", "onsite_only": False, "sprite": {"base": "rodent_small", "tint": "#8a8a8a"},
     "dex_blurb": "The Ramble's most reliable sighting. Bold around foot traffic, everywhere at once."},
    {"taxon_id": 12727, "id": "american_robin", "common_name": "American Robin",
     "habitat_tags": ["lawn", "path"], "time_of_day": ["dawn", "day"],
     "rarity": "common", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#c1440e"},
     "dex_blurb": "Hops across open lawn hunting worms. A spring chorus regular."},
    {"taxon_id": 13858, "id": "house_sparrow", "common_name": "House Sparrow",
     "habitat_tags": ["path", "lawn"], "time_of_day": ["dawn", "day", "dusk"],
     "rarity": "common", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#9b7653"},
     "dex_blurb": "Chattering flocks around benches and trash cans. Introduced, ubiquitous, unbothered."},
    {"taxon_id": 3017, "id": "rock_pigeon", "common_name": "Rock Pigeon",
     "habitat_tags": ["path", "lawn"], "time_of_day": ["dawn", "day", "dusk"],
     "rarity": "common", "onsite_only": False, "sprite": {"base": "bird_medium", "tint": "#6b6b6b"},
     "dex_blurb": "Iridescent necks catching the light on every path in the park."},
    {"taxon_id": 3454, "id": "mourning_dove", "common_name": "Mourning Dove",
     "habitat_tags": ["lawn", "path"], "time_of_day": ["dawn", "day"],
     "rarity": "common", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#c2b8a3"},
     "dex_blurb": "A low, mournful coo drifting over open grass at first light."},

    {"taxon_id": 9083, "id": "northern_cardinal", "common_name": "Northern Cardinal",
     "habitat_tags": ["woodland"], "time_of_day": ["dawn", "day"],
     "rarity": "uncommon", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#cc0000"},
     "dex_blurb": "A flash of red in the understory. The Ramble's woodland thickets are prime territory."},
    {"taxon_id": 39782, "id": "pond_slider", "common_name": "Pond Slider",
     "habitat_tags": ["water", "water_edge"], "time_of_day": ["day"],
     "rarity": "uncommon", "onsite_only": False, "sprite": {"base": "turtle_small", "tint": "#4c6b2f"},
     "dex_blurb": "Stacked on half-submerged logs at the Lake's edge, soaking up sun."},
    {"taxon_id": 6930, "id": "mallard", "common_name": "Mallard",
     "habitat_tags": ["water", "water_edge"], "time_of_day": ["dawn", "day", "dusk"],
     "rarity": "uncommon", "onsite_only": False, "sprite": {"base": "bird_medium", "tint": "#2e6f40"},
     "dex_blurb": "The Lake's year-round residents, dabbling along the shoreline."},
    {"taxon_id": 8229, "id": "blue_jay", "common_name": "Blue Jay",
     "habitat_tags": ["woodland"], "time_of_day": ["dawn", "day"],
     "rarity": "uncommon", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#3b6ea5"},
     "dex_blurb": "Loud, sharp calls through the canopy — the Ramble's self-appointed alarm system."},
    {"taxon_id": 14995, "id": "gray_catbird", "common_name": "Gray Catbird",
     "habitat_tags": ["woodland"], "time_of_day": ["day"],
     "rarity": "uncommon", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#54524f"},
     "dex_blurb": "A cat-like mew from dense tangles. Skulking but everywhere once you learn the call."},
    {"taxon_id": 7089, "id": "canada_goose", "common_name": "Canada Goose",
     "habitat_tags": ["water", "water_edge", "lawn"], "time_of_day": ["day"],
     "rarity": "uncommon", "onsite_only": False, "sprite": {"base": "bird_large", "tint": "#3a3a3a"},
     "dex_blurb": "Grazes the lawns near the water in honking, unhurried squads."},
    {"taxon_id": 792988, "id": "downy_woodpecker", "common_name": "Downy Woodpecker",
     "habitat_tags": ["woodland"], "time_of_day": ["day"],
     "rarity": "uncommon", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#e6e6e6"},
     "dex_blurb": "North America's smallest woodpecker, working the Ramble's deadwood for grubs."},

    {"taxon_id": 10286, "id": "black_and_white_warbler", "common_name": "Black-and-white Warbler",
     "habitat_tags": ["woodland"], "time_of_day": ["dawn", "day"],
     "rarity": "rare", "onsite_only": False, "sprite": {"base": "bird_small", "tint": "#1a1a1a"},
     "dex_blurb": "Creeps head-first down tree trunks like a nuthatch. A May migration highlight."},
    {"taxon_id": 5212, "id": "red_tailed_hawk", "common_name": "Red-tailed Hawk",
     "habitat_tags": ["woodland", "lawn"], "time_of_day": ["day"],
     "rarity": "rare", "onsite_only": False, "sprite": {"base": "bird_large", "tint": "#8b4513"},
     "dex_blurb": "Central Park's most famous raptors nest above the Ramble's canopy."},
    {"taxon_id": 41663, "id": "common_raccoon", "common_name": "Common Raccoon",
     "habitat_tags": ["woodland", "water_edge"], "time_of_day": ["dusk", "night"],
     "rarity": "rare", "onsite_only": True, "sprite": {"base": "rodent_medium", "tint": "#4d4d4d"},
     "dex_blurb": "Emerges from the Ramble's woods at dusk. You have to actually be here to see one."},
]


def load_histogram_weights(taxon_id):
    path = f"{config.INAT_HISTOGRAM_CACHE_DIR}/{taxon_id}.json"
    if not os.path.exists(path):
        return [1.0] * 52, True
    with open(path) as f:
        data = json.load(f)
    weeks = data.get("results", {}).get("week_of_year", {})
    if not weeks:
        return [1.0] * 52, True

    raw = [0] * 52
    for week_str, count in weeks.items():
        week = int(week_str)
        if week == 53:
            week = 52
        raw[week - 1] += count

    max_count = max(raw)
    if max_count == 0:
        return [1.0] * 52, True

    weights = [round(c / max_count, 3) for c in raw]
    return weights, False


def build_species_json():
    entries = []
    flat_fallback_species = []
    for spec in CURATED_SPECIES[: config.SPECIES_CAP]:
        weights, is_flat = load_histogram_weights(spec["taxon_id"])
        if is_flat:
            flat_fallback_species.append(spec["id"])
        entries.append({
            "id": spec["id"],
            "common_name": spec["common_name"],
            "taxon_id": spec["taxon_id"],
            "habitat_tags": spec["habitat_tags"],
            "spawn_weight_by_week": weights,
            "time_of_day": spec["time_of_day"],
            "rarity": spec["rarity"],
            "onsite_only": spec["onsite_only"],
            "sprite": spec["sprite"],
            "dex_blurb": spec["dex_blurb"],
        })
    return entries, flat_fallback_species


def main():
    os.makedirs(config.DATA_DIR, exist_ok=True)

    elements = load_osm_elements()
    grid, width, height, counts, fallback_count = rasterize(elements)
    tiled = build_tiled_json(grid, width, height)
    with open(config.MAP_OUTPUT_FILE, "w") as f:
        json.dump(tiled, f)

    species, flat_fallback = build_species_json()
    with open(config.SPECIES_OUTPUT_FILE, "w") as f:
        json.dump(species, f, indent=2)

    print(f"[build] grid {width}x{height} = {width * height} tiles")
    print(f"[build] tile class counts: {counts} (fallback-to-lawn: {fallback_count})")
    print(f"[build] wrote {config.MAP_OUTPUT_FILE}")
    print(f"[build] {len(species)} species -> {config.SPECIES_OUTPUT_FILE}")
    if flat_fallback:
        print(f"[build] flat/uniform spawn weights (no histogram data): {flat_fallback}")


if __name__ == "__main__":
    main()
