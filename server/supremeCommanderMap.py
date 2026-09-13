"""
Supreme Commander: Forged Alliance - Procedural Map Generator API
Flask backend service that interfaces with the Neroxis Map Generator CLI,
compresses generated maps, and stores them in PocketBase with real-time sync.
"""

import json
import logging
import os
import re
import secrets
import shutil
import subprocess
import zipfile
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from pocketbase import PocketBase
from pocketbase.client import FileUpload, RecordService

# Load environment variables
load_dotenv()

# Configuration
POCKETBASE_URL = os.getenv("POCKETBASE_URL", "http://127.0.0.1:8090")
MAP_LIMIT_GENERATOR = int(os.getenv("MAP_LIMIT_GENERATOR", "10"))
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MAP_GENERATOR_JAR = os.path.join(BASE_DIR, "NeroxisGen_1.8.8.jar")
GENERATED_MAPS_DIR = os.path.join(BASE_DIR, "maps")

ALLOWED_STYLES = {
    "BASIC", "BIG_ISLANDS", "CENTER_LAKE", "DROP_PLATEAU", "FLOODED",
    "HIGH_RECLAIM", "LAND_BRIDGE", "LITTLE_MOUNTAIN", "LOW_MEX",
    "MOUNTAIN_RANGE", "ONE_ISLAND", "SMALL_ISLANDS", "VALLEY", "TEST"
}

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("MapGenerator")

# Initialize PocketBase client and Flask app
client_pb = PocketBase(POCKETBASE_URL)
app = Flask(__name__)
CORS(app)

os.makedirs(GENERATED_MAPS_DIR, exist_ok=True)


def run_java_program(
    max_players: int,
    map_number: int,
    map_size: int,
    output_dir: str,
    style: str = "LAND_BRIDGE"
) -> Tuple[str, bool]:
    """
    Executes the Neroxis Java map generator safely without shell=True to prevent command injection.
    """
    if not os.path.isfile(MAP_GENERATOR_JAR):
        return f"Map generator binary not found at {MAP_GENERATOR_JAR}", False

    if style not in ALLOWED_STYLES:
        style = "LAND_BRIDGE"

    command = [
        "java",
        "-jar",
        MAP_GENERATOR_JAR,
        f"--spawn-count={max_players}",
        f"--num-to-generate={map_number}",
        f"--map-size={map_size}",
        f"--style={style}",
        f"--out-path={output_dir}",
    ]

    try:
        logger.info(f"Executing command: {' '.join(command)}")
        process = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False
        )

        if process.returncode != 0:
            logger.error(f"Generator error: {process.stderr}")
            return process.stderr or "Unknown generator error", False

        return process.stdout, True

    except Exception as exc:
        logger.exception("Failed to execute map generator")
        return str(exc), False


def extract_directory_maps(output_java: str) -> List[str]:
    """
    Extracts paths where maps were saved from Neroxis stdout logs.
    """
    file_locations = re.findall(r"Saving map to (.+)", output_java)
    return [loc.strip() for loc in file_locations]


def find_preview_image(map_directory: str) -> Optional[str]:
    """
    Finds the map preview PNG image within the generated map directory.
    """
    if not os.path.isdir(map_directory):
        return None

    for file_name in os.listdir(map_directory):
        if file_name.lower().endswith(".png"):
            return os.path.join(map_directory, file_name)

    return None


def zip_map_directory(map_directory: str, map_name: str, target_dir: str) -> str:
    """
    Compresses the generated map directory into a zip file for distribution.
    """
    os.makedirs(target_dir, exist_ok=True)
    zip_file_path = os.path.join(target_dir, f"{map_name}.zip")

    with zipfile.ZipFile(zip_file_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for root, _, files in os.walk(map_directory):
            for file in files:
                full_path = os.path.join(root, file)
                archive_name = os.path.join(map_name, os.path.relpath(full_path, map_directory))
                zip_file.write(full_path, archive_name)

    return zip_file_path


def upload_to_storage(
    map_name: str,
    map_zip_path: str,
    map_id: str,
    map_image_path: str,
    max_players: int
) -> Tuple[str, str]:
    """
    Uploads map zip and preview image to PocketBase storage.
    """
    with open(map_zip_path, "rb") as f_zip, open(map_image_path, "rb") as f_img:
        new_map = client_pb.collection("supremecommandermaps").create({
            "map_name": map_name,
            "map_zip": FileUpload((os.path.basename(map_zip_path), f_zip)),
            "map_id": map_id,
            "map_img": FileUpload((os.path.basename(map_image_path), f_img)),
            "giocatori": str(max_players)
        })

    record_pb = RecordService(client_pb, "supremecommandermaps")
    download_url = record_pb.get_file_url(record=new_map, filename=new_map.map_zip)
    image_url = record_pb.get_file_url(record=new_map, filename=new_map.map_img)

    return download_url, image_url


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "GET":
        return jsonify({
            "status": "online",
            "service": "Supreme Commander FA Map Generator API",
            "version": "1.0.0"
        })

    # Validate inputs
    try:
        max_players = int(request.form.get("maxPlayer", 6))
        maps_number = int(request.form.get("mapNumber", 1))
        map_size = int(request.form.get("mapSize", 512))
        map_style = request.form.get("mapStyle", "LAND_BRIDGE")
    except (ValueError, TypeError):
        return jsonify({"error": "Parametri non validi. Devono essere numeri interi."}), 400

    if maps_number < 1 or maps_number > MAP_LIMIT_GENERATOR:
        return jsonify({"error": f"Il numero di mappe deve essere tra 1 e {MAP_LIMIT_GENERATOR}!"}), 400

    if max_players < 2 or max_players > 16:
        return jsonify({"error": "Il numero di giocatori deve essere compreso tra 2 e 16."}), 400

    if map_size < 128 or map_size > 2048:
        return jsonify({"error": "La dimensione della mappa deve essere compresa tra 128 e 2048."}), 400

    # Dedicated temp folder for this batch
    batch_token = secrets.token_hex(6)
    temp_batch_dir = os.path.join(BASE_DIR, "temp_generation", f"batch_{batch_token}")
    os.makedirs(temp_batch_dir, exist_ok=True)

    try:
        output, success = run_java_program(
            max_players=max_players,
            map_number=maps_number,
            map_size=map_size,
            output_dir=temp_batch_dir,
            style=map_style
        )

        if not success:
            logger.error(f"Java generation failed: {output}")
            return jsonify({"error": f"Errore durante la generazione: {output}"}), 500

        map_directories = extract_directory_maps(output)
        if not map_directories:
            return jsonify({"error": "Nessuna directory mappa trovata nell'output del generatore."}), 500

        generated_maps = []

        for map_dir in map_directories:
            map_name = os.path.basename(os.path.normpath(map_dir))
            map_preview = find_preview_image(map_dir)

            if not map_preview:
                logger.warning(f"No preview image found for {map_dir}")
                continue

            map_zip = zip_map_directory(map_dir, map_name, GENERATED_MAPS_DIR)
            map_id = secrets.token_urlsafe(12)

            download_url, map_image_url = upload_to_storage(
                map_name=map_name,
                map_zip_path=map_zip,
                map_id=map_id,
                map_image_path=map_preview,
                max_players=max_players
            )

            map_data = {
                "nome_mappa": map_name,
                "immagine_mappa": map_image_url,
                "download_url": download_url,
                "giocatori": max_players,
                "map_id": map_id
            }
            generated_maps.append(map_data)

        # Backward-compatible response structure with data[0].mappe_generate
        response_payload = [
            {
                "mappe_generate": generated_maps
            }
        ]
        return jsonify(response_payload), 200

    except Exception as exc:
        logger.exception("Unexpected error during map generation workflow")
        return jsonify({"error": f"Errore interno del server: {str(exc)}"}), 500

    finally:
        # Clean up temporary batch folder
        if os.path.exists(temp_batch_dir):
            shutil.rmtree(temp_batch_dir, ignore_errors=True)


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    debug_mode = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
