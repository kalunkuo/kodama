"""Fetch iNaturalist species counts + weekly histograms for the Ramble bbox (plan §5.2)."""

import json
import os
import sys
import time

import requests

import config

BBOX_PARAMS = {
    "nelat": config.BBOX["ne_lat"],
    "nelng": config.BBOX["ne_lon"],
    "swlat": config.BBOX["sw_lat"],
    "swlng": config.BBOX["sw_lon"],
}


def _get(url, params):
    headers = {"User-Agent": config.USER_AGENT}
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_species_counts():
    os.makedirs(config.CACHE_DIR, exist_ok=True)
    params = {**BBOX_PARAMS, "quality_grade": "research", "per_page": 50}
    try:
        data = _get(f"{config.INAT_BASE_URL}/observations/species_counts", params)
    except (requests.RequestException, ValueError) as exc:
        print(f"[fetch_inat] species_counts request failed: {exc!r}", file=sys.stderr)
        print(
            "[fetch_inat] Network access to api.inaturalist.org appears blocked. "
            "Leaving no cache file so build.py fails loudly instead of using stale/fake data.",
            file=sys.stderr,
        )
        return None

    results = data.get("results", [])
    if not results:
        print("[fetch_inat] species_counts returned zero results — not writing cache.", file=sys.stderr)
        return None

    with open(config.INAT_SPECIES_CACHE_FILE, "w") as f:
        json.dump(data, f)

    print(f"[fetch_inat] cached {len(results)} species -> {config.INAT_SPECIES_CACHE_FILE}")
    return data


def fetch_histogram(taxon_id):
    params = {**BBOX_PARAMS, "taxon_id": taxon_id, "quality_grade": "research",
              "date_field": "observed", "interval": "week_of_year"}
    try:
        data = _get(f"{config.INAT_BASE_URL}/observations/histogram", params)
    except (requests.RequestException, ValueError) as exc:
        print(f"[fetch_inat] histogram request failed for taxon {taxon_id}: {exc!r}", file=sys.stderr)
        return None

    os.makedirs(config.INAT_HISTOGRAM_CACHE_DIR, exist_ok=True)
    path = f"{config.INAT_HISTOGRAM_CACHE_DIR}/{taxon_id}.json"
    with open(path, "w") as f:
        json.dump(data, f)
    return data


def fetch_histograms_for_top_species(limit=40):
    species_data = fetch_species_counts()
    if species_data is None:
        return False

    results = species_data.get("results", [])[:limit]
    ok_count = 0
    for entry in results:
        taxon_id = entry["taxon"]["id"]
        result = fetch_histogram(taxon_id)
        if result is not None:
            ok_count += 1
        time.sleep(1)  # be polite to iNat's unauthenticated rate limit

    print(f"[fetch_inat] cached histograms for {ok_count}/{len(results)} species")
    return ok_count > 0


if __name__ == "__main__":
    ok = fetch_histograms_for_top_species()
    sys.exit(0 if ok else 1)
