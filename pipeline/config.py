"""Shared constants for the Ramble data pipeline (plan §4, §5, §9)."""

BBOX = {
    "sw_lat": 40.7755,
    "sw_lon": -73.9725,
    "ne_lat": 40.7795,
    "ne_lon": -73.9665,
}

# Origin for the equirectangular projection (plan §5.1 step 1): bbox center.
ORIGIN_LAT = (BBOX["sw_lat"] + BBOX["ne_lat"]) / 2
ORIGIN_LON = (BBOX["sw_lon"] + BBOX["ne_lon"]) / 2

GRID_METERS_PER_TILE = 1.5

# Locked per plan §9 — Kenney packs are 16px, and the pack decides this, not build.py.
TILE_SIZE_PX = 16

SPECIES_CAP = 15

# water > rock > path > woodland > lawn > boundary (plan §5.1 step 3).
# "rock" is unused for M1 — the Overpass query in §5.1 doesn't fetch rock features.
TILE_CLASS_PRIORITY = ["water", "rock", "path", "woodland", "lawn", "boundary"]

TILE_CLASS_UNKNOWN = "unknown"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
INAT_BASE_URL = "https://api.inaturalist.org/v1"

# Overpass rejects requests with the default python-requests UA (406).
USER_AGENT = "RambleGamePipeline/1.0 (contact: karenkuo0501@gmail.com)"

CACHE_DIR = "pipeline/.cache"
OSM_CACHE_FILE = f"{CACHE_DIR}/osm_raw.json"
INAT_SPECIES_CACHE_FILE = f"{CACHE_DIR}/inat_species_counts.json"
INAT_HISTOGRAM_CACHE_DIR = f"{CACHE_DIR}/inat_histograms"

DATA_DIR = "data"
MAP_OUTPUT_FILE = f"{DATA_DIR}/ramble_map.json"
SPECIES_OUTPUT_FILE = f"{DATA_DIR}/species.json"
