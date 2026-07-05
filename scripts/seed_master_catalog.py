#!/usr/bin/env python3
"""
Hexalyte Master Mobile Catalog — bulk seed via Admin API.

Loads brands, phone models + storage/color variants, and accessories into the
global Master Catalog ONLY (Super Admin). Does NOT push to tenant shops —
tenants import manually from Add Product → Import from Master Catalog.

Safe to re-run: existing items are skipped by name.
Use Admin → Master Catalog → Active toggles to hide items tenants should not see yet.

Requirements: Python 3.9+ (stdlib only — no pip packages).

Usage (local):
  python scripts/seed_master_catalog.py \\
    --base-url http://localhost:3001 \\
    --email admin@hexalyte.com \\
    --password admin

Usage (production):
  python scripts/seed_master_catalog.py \\
    --base-url https://api.hexalyte.com \\
    --email YOUR_PLATFORM_ADMIN_EMAIL \\
    --password YOUR_PASSWORD

Quick mode (minimal built-in seed only, skips if catalog non-empty):
  python scripts/seed_master_catalog.py --base-url ... --email ... --password ... --quick
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

# ---------------------------------------------------------------------------
# Catalog data
# ---------------------------------------------------------------------------

PHONE_BRANDS = [
    "Apple", "Samsung", "Xiaomi", "Redmi", "POCO", "Realme", "Vivo", "Oppo",
    "Honor", "Google Pixel", "Motorola", "Nothing", "OnePlus", "Nokia", "Huawei",
]

ACCESSORY_CATEGORIES = [
    "Chargers", "Cables", "Power Banks", "Earbuds", "Headphones", "Bluetooth Speakers",
    "Cases", "Tempered Glass", "Camera Lens Protectors", "Car Chargers", "Adapters",
    "Memory Cards", "Flash Drives", "Phone Holders", "Ring Holders", "Smart Watches", "Smart Bands",
]

STORAGE_BUDGET = ["64GB", "128GB"]
STORAGE_MID = ["128GB", "256GB"]
STORAGE_FLAGSHIP = ["256GB", "512GB", "1TB"]

COLORS = [
    ("Black", "#1a1a1a"),
    ("White", "#f5f5f5"),
    ("Blue", "#2563eb"),
    ("Silver", "#c0c0c0"),
    ("Green", "#16a34a"),
    ("Purple", "#7c3aed"),
    ("Gray", "#6b7280"),
    ("Gold", "#ca8a04"),
    ("Pink", "#ec4899"),
    ("Natural Titanium", "#a8a29e"),
]

PHONE_MODELS: dict[str, list[tuple[str, str, int]]] = {
    # (model name, storage tier, release year)
    "Samsung": [
        ("Galaxy A05", "budget", 2023),
        ("Galaxy A06", "budget", 2024),
        ("Galaxy A15", "budget", 2024),
        ("Galaxy A16", "budget", 2025),
        ("Galaxy A25", "budget", 2024),
        ("Galaxy A26", "budget", 2025),
        ("Galaxy A35", "mid", 2024),
        ("Galaxy A36", "mid", 2025),
        ("Galaxy A55", "mid", 2024),
        ("Galaxy A56", "mid", 2025),
        ("Galaxy S24", "flagship", 2024),
        ("Galaxy S24+", "flagship", 2024),
        ("Galaxy S24 Ultra", "flagship", 2024),
        ("Galaxy S25", "flagship", 2025),
        ("Galaxy S25+", "flagship", 2025),
        ("Galaxy S25 Ultra", "flagship", 2025),
        ("Galaxy Z Flip6", "flagship", 2024),
        ("Galaxy Z Fold6", "flagship", 2024),
    ],
    "Apple": [
        ("iPhone SE (3rd gen)", "budget", 2022),
        ("iPhone 11", "budget", 2019),
        ("iPhone 11 Pro", "mid", 2019),
        ("iPhone 11 Pro Max", "mid", 2019),
        ("iPhone 12", "budget", 2020),
        ("iPhone 12 mini", "budget", 2020),
        ("iPhone 12 Pro", "mid", 2020),
        ("iPhone 12 Pro Max", "mid", 2020),
        ("iPhone 13", "budget", 2021),
        ("iPhone 13 mini", "budget", 2021),
        ("iPhone 13 Pro", "mid", 2021),
        ("iPhone 13 Pro Max", "mid", 2021),
        ("iPhone 14", "mid", 2022),
        ("iPhone 14 Plus", "mid", 2022),
        ("iPhone 14 Pro", "flagship", 2022),
        ("iPhone 14 Pro Max", "flagship", 2022),
        ("iPhone 15", "mid", 2023),
        ("iPhone 15 Plus", "mid", 2023),
        ("iPhone 15 Pro", "flagship", 2023),
        ("iPhone 15 Pro Max", "flagship", 2023),
        ("iPhone 16", "mid", 2024),
        ("iPhone 16 Plus", "mid", 2024),
        ("iPhone 16 Pro", "flagship", 2024),
        ("iPhone 16 Pro Max", "flagship", 2024),
        ("iPhone 16e", "budget", 2025),
    ],
    "Xiaomi": [
        ("Xiaomi 14", "flagship", 2024),
        ("Xiaomi 14T", "mid", 2024),
        ("Redmi Note 14 Pro", "mid", 2025),
    ],
    "Redmi": [
        ("Redmi 14C", "budget", 2024),
        ("Redmi Note 13", "mid", 2024),
        ("Redmi Note 14", "mid", 2025),
    ],
    "POCO": [
        ("POCO X6 Pro", "mid", 2024),
        ("POCO F6", "mid", 2024),
        ("POCO M6", "budget", 2024),
    ],
    "Realme": [
        ("Realme 12 Pro", "mid", 2024),
        ("Realme C67", "budget", 2024),
        ("Realme GT 6", "flagship", 2024),
    ],
    "Vivo": [
        ("Vivo V30", "mid", 2024),
        ("Vivo Y28", "budget", 2024),
        ("Vivo X100 Pro", "flagship", 2024),
    ],
    "Oppo": [
        ("Oppo Reno 12", "mid", 2024),
        ("Oppo A60", "budget", 2024),
        ("Oppo Find X7", "flagship", 2024),
    ],
    "Honor": [
        ("Honor 200", "mid", 2024),
        ("Honor X9b", "budget", 2024),
        ("Honor Magic 6 Pro", "flagship", 2024),
    ],
    "Google Pixel": [
        ("Pixel 8a", "mid", 2024),
        ("Pixel 9", "mid", 2024),
        ("Pixel 9 Pro", "flagship", 2024),
        ("Pixel 9 Pro XL", "flagship", 2024),
    ],
    "Motorola": [
        ("Moto G54", "budget", 2023),
        ("Moto G84", "mid", 2023),
        ("Edge 50 Pro", "mid", 2024),
    ],
    "Nothing": [
        ("Phone (2a)", "mid", 2024),
        ("Phone (2)", "mid", 2023),
        ("Phone (3)", "flagship", 2025),
    ],
    "OnePlus": [
        ("OnePlus Nord CE 4", "mid", 2024),
        ("OnePlus 12", "flagship", 2024),
        ("OnePlus 12R", "mid", 2024),
    ],
    "Nokia": [
        ("Nokia G42", "budget", 2023),
        ("Nokia X30", "mid", 2023),
    ],
    "Huawei": [
        ("Huawei Nova 12", "mid", 2024),
        ("Huawei Pura 70", "flagship", 2024),
    ],
}

# (category, brand or None, name, optional model)
ACCESSORIES: list[tuple[str, str | None, str, str | None]] = [
    ("Chargers", "Apple", "20W USB-C Power Adapter", None),
    ("Chargers", "Apple", "MagSafe Charger", None),
    ("Chargers", "Samsung", "25W Super Fast Charger", None),
    ("Chargers", "Samsung", "45W Super Fast Charger 2.0", None),
    ("Chargers", "Xiaomi", "33W Fast Charger", None),
    ("Chargers", "OnePlus", "80W SUPERVOOC Charger", None),
    ("Chargers", None, "Universal 18W USB-A Charger", None),
    ("Cables", "Apple", "USB-C to Lightning Cable (1m)", None),
    ("Cables", "Apple", "USB-C to USB-C Cable (2m)", None),
    ("Cables", "Samsung", "USB-C to USB-C Cable (1m)", None),
    ("Cables", None, "Micro USB Cable (1m)", None),
    ("Cables", None, "USB-C to USB-C Cable (1m)", None),
    ("Power Banks", "Samsung", "10000mAh Power Bank", None),
    ("Power Banks", "Xiaomi", "20000mAh Power Bank", None),
    ("Power Banks", None, "10000mAh Slim Power Bank", None),
    ("Earbuds", "Apple", "AirPods (3rd generation)", None),
    ("Earbuds", "Apple", "AirPods Pro (2nd generation)", None),
    ("Earbuds", "Samsung", "Galaxy Buds3 Pro", None),
    ("Earbuds", "Samsung", "Galaxy Buds FE", None),
    ("Earbuds", "Xiaomi", "Redmi Buds 5 Pro", None),
    ("Earbuds", "Nothing", "Ear (a)", None),
    ("Headphones", "Apple", "AirPods Max", None),
    ("Headphones", "Sony", "WH-1000XM5", None),
    ("Bluetooth Speakers", "JBL", "Flip 6", None),
    ("Bluetooth Speakers", "Sony", "SRS-XB13", None),
    ("Cases", "Apple", "Silicone Case", "iPhone 16"),
    ("Cases", "Apple", "Clear Case", "iPhone 16 Pro"),
    ("Cases", "Samsung", "Silicone Case", "Galaxy S25"),
    ("Cases", "Samsung", "Clear Standing Cover", "Galaxy S25 Ultra"),
    ("Cases", None, "Generic TPU Case", None),
    ("Tempered Glass", "Apple", "Tempered Glass", "iPhone 16"),
    ("Tempered Glass", "Samsung", "Tempered Glass", "Galaxy S25"),
    ("Tempered Glass", None, "Universal Tempered Glass", None),
    ("Camera Lens Protectors", "Samsung", "Lens Protector", "Galaxy S25 Ultra"),
    ("Camera Lens Protectors", None, "Camera Lens Protector Set", None),
    ("Car Chargers", None, "Dual USB Car Charger", None),
    ("Car Chargers", "Anker", "36W Dual Port Car Charger", None),
    ("Adapters", "Apple", "Lightning to 3.5mm Adapter", None),
    ("Adapters", None, "USB-C to 3.5mm Adapter", None),
    ("Adapters", None, "USB-C to HDMI Adapter", None),
    ("Memory Cards", "SanDisk", "128GB microSDXC", None),
    ("Memory Cards", "Samsung", "256GB microSDXC EVO Plus", None),
    ("Flash Drives", "SanDisk", "64GB USB 3.0 Flash Drive", None),
    ("Phone Holders", None, "Dashboard Phone Holder", None),
    ("Phone Holders", None, "Magnetic Car Mount", None),
    ("Ring Holders", None, "Metal Ring Holder", None),
    ("Ring Holders", None, "MagSafe Ring Stand", None),
    ("Smart Watches", "Apple", "Apple Watch Series 10", None),
    ("Smart Watches", "Samsung", "Galaxy Watch 7", None),
    ("Smart Watches", "Xiaomi", "Redmi Watch 4", None),
    ("Smart Bands", "Xiaomi", "Mi Band 8", None),
    ("Smart Bands", "Samsung", "Galaxy Fit 3", None),
    ("Smart Bands", "Huawei", "Band 9", None),
]

STORAGE_BY_TIER = {
    "budget": STORAGE_BUDGET,
    "mid": STORAGE_MID,
    "flagship": STORAGE_FLAGSHIP,
}


# ---------------------------------------------------------------------------
# HTTP client
# ---------------------------------------------------------------------------

class ApiClient:
    def __init__(self, base_url: str, token: str | None = None) -> None:
        self.base = base_url.rstrip("/")
        self.token = token

    def request(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        *,
        auth: bool = True,
    ) -> Any:
        url = f"{self.base}{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {detail}") from e

    def login(self, email: str, password: str) -> None:
        res = self.request(
            "POST",
            "/api/v1/auth/login",
            {"email": email, "password": password},
            auth=False,
        )
        if not res.get("success"):
            raise RuntimeError(f"Login failed: {res.get('message', res)}")
        self.token = res["data"]["accessToken"]

    def admin_get(self, path: str) -> list:
        res = self.request("GET", f"/admin/v1/master-catalog{path}")
        return res.get("data") or []

    def admin_post(self, path: str, body: dict) -> dict:
        res = self.request("POST", f"/admin/v1/master-catalog{path}", body)
        return res.get("data") or {}


# ---------------------------------------------------------------------------
# Seed logic
# ---------------------------------------------------------------------------

def storage_for_tier(tier: str) -> list[str]:
    return STORAGE_BY_TIER.get(tier, STORAGE_MID)


def variant_key(storage: str, color_name: str) -> str:
    return f"{storage}|{color_name}"


def seed_quick(client: ApiClient) -> None:
    res = client.request("POST", "/admin/v1/master-catalog/seed", {})
    print(res.get("message", res))


def ensure_category(client: ApiClient, cache: dict[str, str], name: str, order: int) -> str:
    if name in cache:
        return cache[name]
    for row in client.admin_get("/categories"):
        if row["name"] == name:
            cache[name] = row["id"]
            return row["id"]
    row = client.admin_post("/categories", {"name": name, "displayOrder": order})
    cache[name] = row["id"]
    print(f"  + category: {name}")
    return row["id"]


def ensure_brand(client: ApiClient, cache: dict[str, str], name: str, order: int) -> str:
    if name in cache:
        return cache[name]
    for row in client.admin_get("/brands"):
        if row["name"] == name:
            cache[name] = row["id"]
            return row["id"]
    row = client.admin_post("/brands", {"name": name, "type": "BOTH", "displayOrder": order})
    cache[name] = row["id"]
    print(f"  + brand: {name}")
    return row["id"]


def ensure_phone_model(
    client: ApiClient,
    models_cache: dict[tuple[str, str], dict],
    *,
    brand_id: str,
    brand_name: str,
    category_id: str,
    name: str,
    release_year: int,
    storage_tier: str,
    display_order: int,
) -> None:
    key = (brand_name, name)
    existing = models_cache.get(key)
    if not existing:
        for row in client.admin_get("/phone-models"):
            if row.get("brandId") == brand_id and row.get("name") == name:
                existing = row
                break
    if not existing:
        existing = client.admin_post(
            "/phone-models",
            {
                "brandId": brand_id,
                "categoryId": category_id,
                "name": name,
                "releaseYear": release_year,
                "displayOrder": display_order,
                "trackImei": True,
                "defaultWarrantyMonths": 12,
            },
        )
        print(f"  + model: {brand_name} {name}")
        models_cache[key] = existing
    else:
        models_cache[key] = existing

    model_id = existing["id"]
    detail = client.admin_get(f"/phone-models/{model_id}")
    if isinstance(detail, dict) and "variants" in detail:
        model_detail = detail
    else:
        model_detail = existing

    existing_variants = {
        variant_key(v["storage"], v["colorName"])
        for v in (model_detail.get("variants") or [])
    }

    storages = storage_for_tier(storage_tier)
    color_subset = COLORS[:6] if storage_tier == "budget" else COLORS[:8]
    var_order = len(existing_variants) + 1

    for storage in storages:
        for color_name, color_hex in color_subset:
            vk = variant_key(storage, color_name)
            if vk in existing_variants:
                continue
            client.admin_post(
                f"/phone-models/{model_id}/variants",
                {
                    "storage": storage,
                    "colorName": color_name,
                    "colorHex": color_hex,
                    "displayOrder": var_order,
                },
            )
            var_order += 1


def ensure_accessory(
    client: ApiClient,
    cache: set[str],
    *,
    category_id: str,
    brand_id: str | None,
    name: str,
    model_optional: str | None,
    display_order: int,
) -> None:
    key = f"{category_id}|{brand_id or ''}|{name}|{model_optional or ''}"
    if key in cache:
        return
    for row in client.admin_get("/accessories"):
        if (
            row.get("categoryId") == category_id
            and row.get("name") == name
            and (row.get("brandId") or None) == brand_id
            and (row.get("modelOptional") or None) == model_optional
        ):
            cache.add(key)
            return
    body: dict[str, Any] = {
        "categoryId": category_id,
        "name": name,
        "displayOrder": display_order,
    }
    if brand_id:
        body["brandId"] = brand_id
    if model_optional:
        body["modelOptional"] = model_optional
    client.admin_post("/accessories", body)
    print(f"  + accessory: {name}")
    cache.add(key)


def seed_full(client: ApiClient) -> None:
    cat_cache: dict[str, str] = {}
    brand_cache: dict[str, str] = {}
    models_cache: dict[tuple[str, str], dict] = {}
    accessory_cache: set[str] = set()

    print("Categories...")
    mobile_id = ensure_category(client, cat_cache, "Mobile Phones", 1)
    for i, name in enumerate(ACCESSORY_CATEGORIES, start=2):
        ensure_category(client, cat_cache, name, i)

    print("Brands...")
    extra_brands = {"Sony", "JBL", "Anker", "SanDisk"}
    all_brands = list(PHONE_BRANDS) + sorted(extra_brands - set(PHONE_BRANDS))
    for i, name in enumerate(all_brands, start=1):
        ensure_brand(client, brand_cache, name, i)

    print("Phone models + variants...")
    for brand_name, models in PHONE_MODELS.items():
        brand_id = brand_cache.get(brand_name)
        if not brand_id:
            print(f"  ! skip models — brand missing: {brand_name}")
            continue
        for order, (model_name, tier, year) in enumerate(models, start=1):
            ensure_phone_model(
                client,
                models_cache,
                brand_id=brand_id,
                brand_name=brand_name,
                category_id=mobile_id,
                name=model_name,
                release_year=year,
                storage_tier=tier,
                display_order=order,
            )

    print("Accessories...")
    acc_order: dict[str, int] = {}
    for cat_name, brand_name, acc_name, model_opt in ACCESSORIES:
        cat_id = cat_cache.get(cat_name)
        if not cat_id:
            print(f"  ! skip accessory — category missing: {cat_name}")
            continue
        brand_id = brand_cache.get(brand_name) if brand_name else None
        acc_order[cat_name] = acc_order.get(cat_name, 0) + 1
        ensure_accessory(
            client,
            accessory_cache,
            category_id=cat_id,
            brand_id=brand_id,
            name=acc_name,
            model_optional=model_opt,
            display_order=acc_order[cat_name],
        )

    cats = len(client.admin_get("/categories"))
    brands = len(client.admin_get("/brands"))
    models = len(client.admin_get("/phone-models"))
    accs = len(client.admin_get("/accessories"))
    print(f"\nDone. Catalog totals: {cats} categories, {brands} brands, {models} phone models, {accs} accessories.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed Hexalyte Master Catalog via Admin API")
    parser.add_argument(
        "--base-url",
        default=os.environ.get("HEXALYTE_API_URL", "http://localhost:3001"),
        help="API base URL (default: HEXALYTE_API_URL or http://localhost:3001)",
    )
    parser.add_argument(
        "--email",
        default=os.environ.get("HEXALYTE_ADMIN_EMAIL", "admin@hexalyte.com"),
        help="Platform admin email (default: HEXALYTE_ADMIN_EMAIL)",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("HEXALYTE_ADMIN_PASSWORD", ""),
        help="Platform admin password (default: HEXALYTE_ADMIN_PASSWORD)",
    )
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Call built-in /seed endpoint only (minimal data; skips if already seeded)",
    )
    args = parser.parse_args()

    if not args.password:
        print("Error: set --password or HEXALYTE_ADMIN_PASSWORD", file=sys.stderr)
        return 1

    client = ApiClient(args.base_url)
    print(f"Logging in as {args.email}...")
    client.login(args.email, args.password)
    print("Authenticated.\n")

    if args.quick:
        print("Running quick seed...")
        seed_quick(client)
    else:
        print("Running full catalog seed (idempotent)...")
        seed_full(client)

    return 0


if __name__ == "__main__":
    sys.exit(main())
