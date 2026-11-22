#!/usr/bin/env python3
"""
GreenHarvest Document Intelligence & Perceptual Hashing Engine
Provides local OCR extraction, regex identity parsing (Fayda, Kebele, TIN),
RapidFuzz identity duplicate matching, and perceptual image hashing (dHash).
"""

import sys
import os
import json
import re
import hashlib
from typing import Dict, Any, List, Optional
from PIL import Image

try:
    from rapidfuzz import fuzz
except ImportError:
    # Minimal fallback if rapidfuzz not present
    class MockFuzz:
        @staticmethod
        def token_sort_ratio(s1: str, s2: str) -> float:
            w1 = set(s1.lower().split())
            w2 = set(s2.lower().split())
            if not w1 or not w2:
                return 0.0
            return (2.0 * len(w1 & w2) / (len(w1) + len(w2))) * 100.0
    fuzz = MockFuzz()


# ==============================================================================
# 1. PERCEPTUAL IMAGE HASHING (dHash)
# ==============================================================================

def compute_dhash(image_path: str, hash_size: int = 8) -> str:
    """
    Computes a 64-bit difference hash (dHash) of an image.
    Resizes image to (hash_size + 1, hash_size), converts to grayscale,
    and compares adjacent pixels.
    """
    try:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        with Image.open(image_path) as img:
            # Convert to grayscale and resize to (width=9, height=8)
            img = img.convert("L").resize((hash_size + 1, hash_size), Image.Resampling.LANCZOS)
            get_pixels = getattr(img, "get_flattened_data", None) or img.getdata
            pixels = list(get_pixels())

            difference = []
            for row in range(hash_size):
                for col in range(hash_size):
                    pixel_left = pixels[row * (hash_size + 1) + col]
                    pixel_right = pixels[row * (hash_size + 1) + col + 1]
                    difference.append(pixel_left > pixel_right)

            # Convert boolean array to hex string (64 bits = 16 hex characters)
            decimal_value = 0
            hex_string = []
            for index, value in enumerate(difference):
                if value:
                    decimal_value += 2 ** (index % 4)
                if (index % 4) == 3:
                    hex_string.append(hex(decimal_value)[2:])
                    decimal_value = 0

            return "".join(hex_string)
    except Exception as e:
        # Fallback pseudo-hash based on file content if image decoding fails
        try:
            with open(image_path, "rb") as f:
                content = f.read(4096)
                return hashlib.sha256(content).hexdigest()[:16]
        except Exception:
            return "0000000000000000"


def hamming_distance(hash1: str, hash2: str) -> int:
    """
    Calculates the Hamming distance between two hex hashes (number of bit differences).
    0 = identical, < 5 = near duplicate, > 10 = distinct.
    """
    if not hash1 or not hash2:
        return 64
    try:
        # Pad or truncate to equal length
        max_len = max(len(hash1), len(hash2))
        h1 = int(hash1.ljust(max_len, "0"), 16)
        h2 = int(hash2.ljust(max_len, "0"), 16)
        xor_val = h1 ^ h2
        return bin(xor_val).count("1")
    except Exception:
        # Fallback character difference
        return sum(c1 != c2 for c1, c2 in zip(hash1, hash2))


# ==============================================================================
# 2. DOCUMENT OCR & REGEX EXTRACTION (Fayda, Kebele, TIN)
# ==============================================================================

REGIONS = [
    "Oromia", "ኦሮሚያ",
    "Amhara", "አማራ",
    "Sidama", "ሲዳማ",
    "Tigray", "ትግራይ",
    "Somali", "ሶማሌ",
    "Afar", "አፋር",
    "Benishangul", "ቤኒሻንጉል",
    "Gambella", "ጋምቤላ",
    "Harari", "ሐረሪ",
    "Addis Ababa", "አዲስ አበባ",
    "Dire Dawa", "ድሬዳዋ",
    "South Ethiopia", "ደቡብ ኢትዮጵያ",
    "Central Ethiopia", "ማዕከላዊ ኢትዮጵያ"
]


def extract_kyc_fields(text: str, document_type: str = "national_id") -> Dict[str, Any]:
    """
    Parses OCR text to extract structured Ethiopian identity fields.
    Supports Fayda (12-digit), Kebele ID, and Tax ID (10-digit).
    """
    cleaned_text = text.replace("\r", " ").strip()
    extracted: Dict[str, Any] = {
        "id_number": None,
        "full_name": None,
        "region": None,
        "woreda": None,
        "kebele": None,
        "tin": None,
        "id_type_detected": None,
    }
    confidence_points = 0.0

    # 1. National ID / Fayda (12 digits, often in 4-4-4 format: 1234 5678 9012 or 1234-5678-9012)
    fayda_match = re.search(r"\b(\d{4})[ -]?(\d{4})[ -]?(\d{4})\b", cleaned_text)
    if fayda_match:
        fayda_num = f"{fayda_match.group(1)}{fayda_match.group(2)}{fayda_match.group(3)}"
        extracted["id_number"] = fayda_num
        extracted["id_type_detected"] = "fayda_national_id"
        confidence_points += 40.0

    # 2. TIN Number (10 consecutive digits)
    tin_match = re.search(r"(?:TIN|ግብር)[:.\s]*(\d{10})\b|\b(\d{10})\b", cleaned_text, re.IGNORECASE)
    if tin_match:
        tin_num = tin_match.group(1) or tin_match.group(2)
        extracted["tin"] = tin_num
        if not extracted["id_number"]:
            extracted["id_number"] = tin_num
            extracted["id_type_detected"] = "tax_id"
        confidence_points += 20.0

    # 3. Kebele ID formats (e.g., ID: OR/BSH/99128, KBL-12903, or standalone alphanumeric ID)
    if not extracted["id_number"]:
        kebele_id_match = re.search(
            r"(?:ID\s*(?:NO|Number|ቁጥር)?|Card\s*(?:No|Number)?|(?:መታወቂያ\s*(?:ቁጥር)?)|ቁጥር)[:.\s]*([A-Z0-9/\-]{4,20})",
            cleaned_text,
            re.IGNORECASE
        )
        if kebele_id_match:
            extracted["id_number"] = kebele_id_match.group(1).strip()
            extracted["id_type_detected"] = "kebele_id"
            confidence_points += 35.0

    # 4. Full Name extraction
    # Matches "Name: Abebe Bikila" or "የባለቤቱ ስም: አበበ ቢቂላ" or line following "Full Name"
    name_match = re.search(
        r"(?:Full\s*Name|Name|ስም|የባለቤቱ\s*ስም)[:.\s]+([A-Za-z\u1200-\u137F\s]{3,40}?)(?=[,\n]|\s{2,}|ID|Fayda|DOB|ፆታ|$)",
        cleaned_text,
        re.IGNORECASE
    )
    if name_match:
        extracted["full_name"] = name_match.group(1).strip()
        confidence_points += 30.0
    else:
        # Fallback: inspect lines for 2-3 capitalized or Ethiopic words
        for line in cleaned_text.split("\n"):
            line_str = line.strip()
            if len(line_str.split()) in [2, 3] and not re.search(r"\d", line_str) and len(line_str) >= 6:
                if not any(header in line_str.lower() for header in ["republic", "ethiopia", "federation", "national", "kebele", "card"]):
                    extracted["full_name"] = line_str
                    confidence_points += 20.0
                    break

    # 5. Region extraction
    for reg in REGIONS:
        if reg.lower() in cleaned_text.lower():
            extracted["region"] = reg
            confidence_points += 15.0
            break

    # 6. Woreda and Kebele extraction
    woreda_match = re.search(r"(?:Woreda|ወረዳ)[:.\s]*([A-Za-z0-9\u1200-\u137F\s]+?)(?=[,\n]|Kebele|ቀበሌ|$)", cleaned_text, re.IGNORECASE)
    if woreda_match:
        extracted["woreda"] = woreda_match.group(1).strip()
        confidence_points += 7.5

    kebele_match = re.search(r"(?:Kebele|ቀበሌ)[:.\s]*([A-Za-z0-9\u1200-\u137F\s]+?)(?=[,\n]|ID|ቁጥር|$)", cleaned_text, re.IGNORECASE)
    if kebele_match:
        extracted["kebele"] = kebele_match.group(1).strip()
        confidence_points += 7.5

    # Compute SHA-256 id_hash if ID number found
    id_hash = None
    if extracted["id_number"]:
        norm_id = str(extracted["id_number"]).strip().upper()
        id_hash = hashlib.sha256(norm_id.encode("utf-8")).hexdigest()

    confidence_score = min(100.0, round(confidence_points, 2))

    return {
        "raw_text": cleaned_text,
        "extracted_fields": extracted,
        "id_hash": id_hash,
        "confidence_score": confidence_score
    }


def parse_document_file(file_path: str, document_type: str = "national_id") -> Dict[str, Any]:
    """
    Performs OCR and field extraction on an uploaded document file.
    Uses pytesseract if system tesseract is available, or parses text/fallback.
    """
    if not os.path.exists(file_path):
        return {
            "error": f"File not found: {file_path}",
            "raw_text": "",
            "extracted_fields": {},
            "id_hash": None,
            "confidence_score": 0.0
        }

    raw_text = ""
    # Try pytesseract OCR if image
    try:
        import pytesseract
        with Image.open(file_path) as img:
            # Grayscale pre-processing
            gray = img.convert("L")
            try:
                raw_text = pytesseract.image_to_string(gray, lang="amh+eng")
            except Exception:
                try:
                    raw_text = pytesseract.image_to_string(gray, lang="eng")
                except Exception:
                    raw_text = ""
    except Exception:
        raw_text = ""

    # If file is text or OCR produced nothing, try reading text directly
    if not raw_text.strip():
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                raw_text = f.read()
        except Exception:
            raw_text = ""

    return extract_kyc_fields(raw_text, document_type)


# ==============================================================================
# 3. IDENTITY DUPLICATE DETECTION (RapidFuzz)
# ==============================================================================

def check_identity_duplicate(
    target_farmer: Dict[str, Any],
    existing_farmers: List[Dict[str, Any]],
    similarity_threshold: float = 85.0
) -> Dict[str, Any]:
    """
    Compares target farmer against registered farmers to detect potential duplicate identities.
    Checks exact ID hash matches as well as fuzzy name + location matches using RapidFuzz.
    """
    matches = []
    target_name = (target_farmer.get("name") or target_farmer.get("full_name") or "").strip()
    target_id_hash = target_farmer.get("id_hash")
    target_id_number = str(target_farmer.get("id_number") or "").strip()
    target_location = f"{target_farmer.get('region', '')} {target_farmer.get('woreda', '')} {target_farmer.get('kebele', '')}".strip()

    for cand in existing_farmers:
        # Ignore self
        cand_id = cand.get("id") or cand.get("user_id")
        if target_farmer.get("id") and str(cand_id) == str(target_farmer.get("id")):
            continue

        cand_name = (cand.get("name") or cand.get("full_name") or "").strip()
        cand_id_hash = cand.get("id_hash")
        cand_id_number = str(cand.get("id_number") or "").strip()
        cand_location = f"{cand.get('region', '')} {cand.get('woreda', '')} {cand.get('kebele', '')}".strip()

        # 1. Exact ID number / ID Hash match -> High Severity duplicate
        if target_id_hash and cand_id_hash and target_id_hash == cand_id_hash:
            matches.append({
                "farmer_id": cand_id,
                "name": cand_name,
                "match_type": "exact_id_hash",
                "similarity": 100.0,
                "details": "Identical National ID / Fayda document hash already registered"
            })
            continue

        if target_id_number and cand_id_number and len(target_id_number) >= 6 and target_id_number.upper() == cand_id_number.upper():
            matches.append({
                "farmer_id": cand_id,
                "name": cand_name,
                "match_type": "exact_id_number",
                "similarity": 100.0,
                "details": f"Identical ID Number '{cand_id_number}' already registered"
            })
            continue

        # 2. Fuzzy Name & Location match
        if target_name and cand_name:
            sort_score = fuzz.token_sort_ratio(target_name.lower(), cand_name.lower())
            set_score = fuzz.token_set_ratio(target_name.lower(), cand_name.lower())
            name_score = max(sort_score, set_score)
            loc_score = fuzz.token_set_ratio(target_location.lower(), cand_location.lower()) if (target_location and cand_location) else 50.0

            if name_score >= similarity_threshold and loc_score >= 50.0:
                matches.append({
                    "farmer_id": cand_id,
                    "name": cand_name,
                    "match_type": "fuzzy_identity",
                    "similarity": round(name_score, 2),
                    "details": f"High name similarity ({round(name_score, 1)}%) in same region/location ({round(loc_score, 1)}%)"
                })

    is_duplicate = len(matches) > 0
    return {
        "is_duplicate": is_duplicate,
        "match_count": len(matches),
        "matches": matches,
        "highest_risk": matches[0] if matches else None
    }


# ==============================================================================
# 4. CLI RUNNER INTERFACE (JSON in, JSON out)
# ==============================================================================

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Command required: image_hash, ocr_parse, ocr_text, check_duplicate"}))
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "image_hash":
        # python processor.py image_hash <file_path>
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Image file path required"}))
            sys.exit(1)
        image_path = sys.argv[2]
        h = compute_dhash(image_path)
        print(json.dumps({"image_hash": h, "file_path": image_path}))

    elif cmd == "compare_hashes":
        # python processor.py compare_hashes <hash1> <hash2>
        if len(sys.argv) < 4:
            print(json.dumps({"error": "Two hashes required"}))
            sys.exit(1)
        h1 = sys.argv[2]
        h2 = sys.argv[3]
        dist = hamming_distance(h1, h2)
        is_duplicate = dist < 5
        print(json.dumps({"distance": dist, "is_duplicate": is_duplicate}))

    elif cmd == "ocr_parse":
        # python processor.py ocr_parse <file_path> [doc_type]
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Document file path required"}))
            sys.exit(1)
        file_path = sys.argv[2]
        doc_type = sys.argv[3] if len(sys.argv) > 3 else "national_id"
        result = parse_document_file(file_path, doc_type)
        print(json.dumps(result))

    elif cmd == "ocr_text":
        # python processor.py ocr_text (reads json payload from stdin or argv)
        if len(sys.argv) > 2:
            input_text = sys.argv[2]
            doc_type = sys.argv[3] if len(sys.argv) > 3 else "national_id"
        else:
            payload = json.loads(sys.stdin.read())
            input_text = payload.get("text", "")
            doc_type = payload.get("document_type", "national_id")
        result = extract_kyc_fields(input_text, doc_type)
        print(json.dumps(result))

    elif cmd == "check_duplicate":
        # python processor.py check_duplicate (reads JSON payload from stdin: { target, candidates })
        payload = json.loads(sys.stdin.read())
        target = payload.get("target", {})
        candidates = payload.get("candidates", [])
        threshold = float(payload.get("threshold", 85.0))
        result = check_identity_duplicate(target, candidates, threshold)
        print(json.dumps(result))

    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))
        sys.exit(1)


if __name__ == "__main__":
    main()
