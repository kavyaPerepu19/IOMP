from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

CELESTRAK_TLE_BY_NAME = "https://celestrak.org/NORAD/elements/gp.php"
CELESTRAK_ACTIVE = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
WIKI_SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{}"
WIKI_SEARCH = "https://en.wikipedia.org/w/api.php?action=opensearch&search={}&limit=1&namespace=0&format=json"

@app.get("/api/tle")
def get_tle_by_name():
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"error": "Missing 'name' query param"}), 400

    try:
        r = requests.get(CELESTRAK_TLE_BY_NAME, params={"NAME": name, "FORMAT": "TLE"}, timeout=15)
        r.raise_for_status()
        text = r.text.strip()
        if not text:
            return jsonify({"error": "No TLE found"}), 404

        # Extract the *first* TLE set (handle optional name lines like "0 SATNAME")
        lines = [ln for ln in text.splitlines() if ln.strip()]
        line1_idx = None
        for i, ln in enumerate(lines):
            if ln.startswith("1 ") and i + 1 < len(lines) and lines[i+1].startswith("2 "):
                line1_idx = i
                break
        if line1_idx is None:
            return jsonify({"error": "Malformed TLE response"}), 502

        # Satellite name is previous non-numeric line if present, else use query
        sat_name = name
        if line1_idx - 1 >= 0 and not lines[line1_idx-1].startswith(("1 ", "2 ")):
            sat_name = lines[line1_idx-1].strip().lstrip("0 ")

        line1 = lines[line1_idx].strip()
        line2 = lines[line1_idx+1].strip()
        return jsonify({"name": sat_name, "line1": line1, "line2": line2, "raw": text})
    except requests.RequestException as e:
        return jsonify({"error": f"Upstream error: {e}"}), 502

@app.get("/api/active")
def get_active_tles():
    try:
        r = requests.get(CELESTRAK_ACTIVE, timeout=20)
        r.raise_for_status()
        # Return as plain text (name + L1 + L2 repeating)
        return Response(r.text, mimetype="text/plain")
    except requests.RequestException as e:
        return jsonify({"error": f"Upstream error: {e}"}), 502

@app.get("/api/info")
def get_info():
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"error": "Missing 'name' query param"}), 400

    google_search_url = f"https://www.google.com/search?q={quote(name)}"
    info = {"title": name, "extract": None, "wikipedia_url": None, "google_search_url": google_search_url}

    # Try direct wiki summary
    try:
        rs = requests.get(WIKI_SUMMARY.format(quote(name)), timeout=10)
        if rs.status_code == 200:
            js = rs.json()
            info["title"] = js.get("title") or name
            info["extract"] = js.get("extract")
            info["wikipedia_url"] = js.get("content_urls", {}).get("desktop", {}).get("page")
            return jsonify(info)
    except requests.RequestException:
        pass

    # Fallback: wiki search -> then summary of first hit
    try:
        rs = requests.get(WIKI_SEARCH.format(quote(name)), timeout=10)
        if rs.status_code == 200:
            arr = rs.json()
            if isinstance(arr, list) and len(arr) >= 2 and arr[1]:
                best = arr[1][0]
                rs2 = requests.get(WIKI_SUMMARY.format(quote(best)), timeout=10)
                if rs2.status_code == 200:
                    js = rs2.json()
                    info["title"] = js.get("title") or best
                    info["extract"] = js.get("extract")
                    info["wikipedia_url"] = js.get("content_urls", {}).get("desktop", {}).get("page")
    except requests.RequestException:
        pass

    return jsonify(info)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
