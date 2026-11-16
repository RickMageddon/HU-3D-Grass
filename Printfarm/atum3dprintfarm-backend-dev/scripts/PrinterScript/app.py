from flask import Flask, jsonify, request, render_template_string
from flask_sock import Sock
import time
import json
import threading
import websocket

app = Flask(__name__)
sock = Sock(app)

# -----------------------------
# CONFIGURE EXTERNAL LOG SERVER HERE
# -----------------------------

EXTERNAL_LOG_WS = "ws://localhost:9000"  # adjust your port/path
external_ws = None

def ensure_external_connected():
    global external_ws  
    if external_ws is None or not external_ws.connected:
        try:
            print("Connecting to external WebSocket...")
            external_ws = websocket.create_connection(EXTERNAL_LOG_WS)
            print("Connected to external WebSocket")
        except Exception as e:
            print("Failed to connect to external WS:", e)
            external_ws = None

def forward_to_external(message: str):
    global external_ws  
    ensure_external_connected()
    if external_ws:
        try:
            external_ws.send(message)
            print("FORWARDED TO EXTERNAL:", message)
        except Exception as e:
            print("Failed to forward:", e)
            external_ws = None

# -----------------------------
# Mock Data
# -----------------------------
current_progress = {
    "currentPrintProgress": 0.15,
    "currentPrintTime": 120,
    "currentPrintTimeLeft": 880,
    "totalLayers": 200,
    "currentLayer": 30,
    "paused": False,
    "preparing": False
}

current_print_job_metadata = {
    "name": "test_job.cws",
    "filepath": "/usb/test_job.cws",
    "volume": "12.5ml",
    "duration": "25m",
    "material_name": "ABS-like resin"
}

printer_config = {
    "name": "Test Printer",
    "intensity": 0.8,
    "ip": "192.168.1.50",
    "resin_level_threshold": 20,
    "motors": [],
    "on_off_devices": [],
    "sensors": [],
    "microcontroller_ip": "192.168.1.51",
    "projector_ip": "192.168.1.52",
    "homing_speed": 10.0,
    "normal_speed": 30.0,
    "move_distance": 0.5,
    "back_off_distance": 2.0,
    "z_axis_resin_distance": 1.0,
    "printer_server": {
        "port": 8080,
        "ip": "192.168.1.60",
        "enabled": True
    },
    "top_down_printer": False
}

printer_state = {
    "on_usb": [current_print_job_metadata],
    "history": [],
    "usb_location": "/usb",
    "print_job_manager": None,
    "peripheral_config": printer_config
}

clients = set()

# -----------------------------
# REST API
# -----------------------------
@app.route("/progress")
def get_progress():
    return jsonify(current_progress)


@app.route("/printer_config")
def get_printer_config():
    return jsonify(printer_config)


@app.route("/printer_state")
def get_printer_state():
    return jsonify(printer_state)


@app.route("/current_print_job_metadata")
def get_metadata():
    return jsonify(current_print_job_metadata)


@app.route("/set_progress", methods=["POST"])
def set_progress():
    data = request.json or {}
    for k in current_progress:
        if k in data:
            current_progress[k] = data[k]
    return jsonify(current_progress)


# -----------------------------
# WebSocket log broadcast
# -----------------------------
def broadcast(message):
    # local browser listeners
    dead = []
    for ws in clients:
        try:
            ws.send(message)
        except Exception:
            dead.append(ws)

    for d in dead:
        clients.remove(d)

    forward_to_external(message)


@sock.route("/logs")
def logs(ws):
    clients.add(ws)
    while True:
        msg = ws.receive()

        if msg is None:
            break

        try:
            data = json.loads(msg)
        except Exception as e:
            print("!! JSON decode failed:", e)
            continue

        log = {
            "level": data.get("level", "info"),
            "ts": time.time(),
            "msg": data.get("message", "")
        }

        log_json = json.dumps(log)
        broadcast(log_json)


# -----------------------------
# Browser UI
# -----------------------------
HTML = r"""
<h1>Printer Simulator</h1>

<h2>Update Progress</h2>
<form onsubmit="setProgress(); return false;">
  Progress (0-1): <input id="p" type="number" step="0.01" min="0" max="1"><br>
  Current Layer: <input id="cl" type="number"><br>
  Total Layers: <input id="tl" type="number"><br>

  <label>
    <input type="checkbox" id="paused"> Paused
  </label><br>

  <label>
    <input type="checkbox" id="preparing"> Preparing
  </label><br>

  <button type="submit">Update</button>
</form>

<hr>

<h2>Send Log</h2>
<form onsubmit="sendLog(); return false;">
  Message: <input id="logmsg" type="text">
  Level: 
  <select id="loglevel">
    <option value="info" selected>info</option>
    <option value="debug">debug</option>
    <option value="warn">warn</option>
    <option value="error">error</option>
  </select>
  <button type="submit">Send</button>
</form>

<h2>Logs</h2>
<pre id="logbox" style="height:300px;overflow:auto;border:1px solid #ccc;"></pre>

<script>
let ws = new WebSocket("ws://" + location.host + "/logs");

ws.onmessage = (event) => {
    const logBox = document.getElementById("logbox");
    logBox.textContent += event.data + "\n";
    logBox.scrollTop = logBox.scrollHeight; // auto-scroll
};

function sendLog() {
    let message = document.getElementById("logmsg").value;
    let level = document.getElementById("loglevel").value;

    ws.send(JSON.stringify({message: message, level: level}));
    document.getElementById("logmsg").value = ""; // clear input
}

function setProgress() {
    fetch("/set_progress", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            currentPrintProgress: parseFloat(document.getElementById("p").value),
            currentLayer: parseInt(document.getElementById("cl").value),
            totalLayers: parseInt(document.getElementById("tl").value),
            paused: document.getElementById("paused").checked,
            preparing: document.getElementById("preparing").checked
        })
    });
}
</script>
"""

@app.route("/")
def index():
    return render_template_string(HTML)


if __name__ == "__main__":
    threading.Thread(target=ensure_external_connected).start()
    app.run(host="0.0.0.0", port=5002)
