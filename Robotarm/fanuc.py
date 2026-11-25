"""Control the FANUC R-30iA from a PC or Raspberry Pi. See README.md.

How it works: the TP program PI_DISP runs on the controller and waits for a
number in R[100]. This script writes that number over the controller's web
server, PI_DISP CALLs the matching program, then sets R[100] back to 0.
Telnet KCL logs in but does not answer commands on this controller, and HTTP
KCL refuses RUN (HOST-238 Protected KCL command), hence the register handshake.

Run `python3 fanuc.py -h` for the commands.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROBOT = os.environ.get("FANUC_IP", "10.0.6.10")
POSES_FILE = Path(__file__).with_name("poses.json")
REQ, BUSY = 100, 101  # R[100] = requested program, R[101] = program running
# Must match the IF lines in PI_DISP.LS.
PROGRAMS = {"PI_PING": 1, "TEST": 2, "CLAUDE_J6": 3,
            "PRINTER1": 4, "PRINTER2": 5, "PRINTER3": 6, "SHELVE": 7, "PI_MOVE": 9}
MOVE_SPEED, MOVE_JOINTS = 110, 111  # PI_MOVE reads speed % from R[110], J1..J6 from R[111..116]

# Our own joint limits in degrees (J1..J6), checked before every move() call.
# Must lie inside the controller's axis limits ($PARAM_GROUP[1].$UPPERLIMS/$LOWERLIMS):
# J1 ±170, J2 -90..160, J3 -170..285, J4 ±200, J5 ±140, J6 ±450.
# Start tight around the work area and widen as the cell is cleared.
JOINT_LIMITS = [(-170, 170), (-90, 160), (-170, 285), (-200, 200), (-140, 140), (-450, 450)]
MAX_SPEED = 30  # percent; T1 caps real speed at 250 mm/s regardless


def _get(path: str, timeout: float = 5) -> str:
    with urllib.request.urlopen(f"http://{ROBOT}{path}", timeout=timeout) as r:
        return re.sub(r"<[^>]*>", "", r.read().decode("latin-1"))


def kcl(command: str) -> str:
    """Run an unprotected KCL command (e.g. SHOW VAR $VERSION) and return its output."""
    text = _get("/KCL/" + urllib.parse.quote(command))
    if "Protected KCL command" in text:
        raise PermissionError(f"controller refuses KCL command over HTTP: {command}")
    return text.split("Time:", 1)[-1].split("\n", 1)[-1].strip()


def get_reg(n: int) -> float:
    m = re.search(rf"^\s*\[{n}\]\s*=\s*(-?[\d.]+)", _get("/MD/NUMREG.VA"), re.M)
    if not m:
        raise ValueError(f"R[{n}] not found")
    return float(m.group(1))


def set_reg(n: int, value: int) -> None:
    _get(f"/KAREL/ComSet?sValue={int(value)}&sIndx={n}&sRealFlag=-1&sFc=2")


def joints() -> list[float]:
    return [float(v) for v in re.findall(r"Joint\s+\d:\s*(-?[\d.]+)", _get("/MD/CURPOS.DG"))[:6]]


def alarms(count: int = 5) -> list[str]:
    lines = re.findall(r'^\s*\d+"\s*([^"]+)"\s*([^"]+)"', _get("/MD/ERRALL.LS"), re.M)
    return [f"{t.strip()}  {msg.strip()}" for t, msg in lines[:count]]


def dispatcher_running() -> bool:
    return bool(re.search(r"PI_DISP\s+RUNNING", _get("/MD/PRGSTATE.DG")))


def _check_ready() -> None:
    if not dispatcher_running():
        raise RuntimeError("PI_DISP is not running on the controller; start it on the pendant first")
    if get_reg(REQ) != 0 or get_reg(BUSY) != 0:
        raise RuntimeError("PI_DISP is busy with another program")


def run(name: str, timeout: float = 600) -> None:
    """Ask PI_DISP to run program `name` and block until it has finished."""
    number = PROGRAMS.get(name.upper())
    if number is None:
        raise ValueError(f"{name} is not in PROGRAMS (and PI_DISP.LS): {sorted(PROGRAMS)}")
    _check_ready()
    set_reg(REQ, number)
    deadline = time.monotonic() + timeout
    while get_reg(REQ) != 0:
        if time.monotonic() > deadline:
            raise TimeoutError(f"{name} did not finish within {timeout:.0f} s; check the pendant")
        if not dispatcher_running():
            raise RuntimeError(f"PI_DISP stopped while running {name}: {alarms(3)}")
        time.sleep(0.3)


def check_target(target: list[float], speed: float) -> None:
    """Raise ValueError if the target or speed is outside our limits."""
    if len(target) != 6:
        raise ValueError(f"need 6 joint angles, got {len(target)}")
    for i, (value, (lo, hi)) in enumerate(zip(target, JOINT_LIMITS), 1):
        if not lo <= value <= hi:
            raise ValueError(f"J{i}={value} outside limit [{lo}, {hi}]")
    if not 1 <= speed <= MAX_SPEED:
        raise ValueError(f"speed {speed}% outside 1..{MAX_SPEED}%")


def programs() -> list[str]:
    """Names of all TP programs on the controller."""
    return re.findall(r"^(\S+)\s+\.TP\s", kcl("DIRECTORY MD:*.TP"), re.M)


def move(target: list[float], speed: float = 10, timeout: float = 600) -> None:
    """Joint-move to J1..J6 (degrees) via PI_MOVE, after checking JOINT_LIMITS."""
    check_target(target, speed)
    _check_ready()  # never change the targets while a move may be reading them
    for i, value in enumerate(target):
        _get(f"/KAREL/ComSet?sValue={value:.3f}&sIndx={MOVE_JOINTS + i}&sRealFlag=1&sFc=2")
    set_reg(MOVE_SPEED, round(speed))
    written = [get_reg(MOVE_JOINTS + i) for i in range(6)]
    if any(abs(w - t) > 0.01 for w, t in zip(written, target)):
        raise RuntimeError(f"register write mismatch: wrote {target}, read back {written}")
    run("PI_MOVE", timeout)


def jog(joint: int, delta: float, speed: float = 10) -> None:
    """Move one joint (1..6) by `delta` degrees from where it is now."""
    if not 1 <= joint <= 6:
        raise ValueError("joint must be 1..6")
    target = joints()
    target[joint - 1] += delta
    move(target, speed)


def load_poses() -> dict[str, list[float]]:
    return json.loads(POSES_FILE.read_text()) if POSES_FILE.exists() else {}


def save_pose(name: str) -> list[float]:
    """Store the current joint angles under `name` in poses.json."""
    poses = load_poses()
    poses[name] = joints()
    POSES_FILE.write_text(json.dumps(poses, indent=2) + "\n")
    return poses[name]


def goto(name: str, speed: float = 10) -> None:
    poses = load_poses()
    if name not in poses:
        raise ValueError(f"no pose {name!r} in {POSES_FILE.name}: {sorted(poses)}")
    move(poses[name], speed)


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(prog="fanuc.py", description="Control the FANUC arm via PI_DISP.")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status", help="dispatcher state, registers, joints, alarms")
    sub.add_parser("watch", help="live joint angles (Ctrl-C to stop)")
    sub.add_parser("programs", help="list TP programs on the controller")
    sub.add_parser("alarms", help="last 10 alarms")
    sub.add_parser("poses", help="list saved poses")
    sub.add_parser("run", help="run a program listed in PROGRAMS").add_argument("name")
    m = sub.add_parser("move", help="joint move to absolute angles")
    m.add_argument("angles", type=float, nargs=6, metavar="J")
    j = sub.add_parser("jog", help="move one joint by a relative amount")
    j.add_argument("joint", type=int)
    j.add_argument("delta", type=float)
    sub.add_parser("save", help="save the current position as a named pose").add_argument("name")
    sub.add_parser("goto", help="move to a saved pose").add_argument("name")
    for cmd in (m, j, sub.choices["goto"]):
        cmd.add_argument("--speed", type=float, default=10, help=f"percent, 1..{MAX_SPEED} (default 10)")
    a = p.parse_args(argv)

    try:
        if a.cmd == "status":
            print("version   :", kcl("SHOW VAR $VERSION").splitlines()[-1].strip())
            print("dispatcher:", "RUNNING" if dispatcher_running() else "not running")
            print(f"R[{REQ}]/R[{BUSY}]:", get_reg(REQ), get_reg(BUSY))
            print("joints    :", joints())
            print("alarms    :", *alarms(), sep="\n  ")
        elif a.cmd == "watch":
            while True:
                print(" ".join(f"{v:8.2f}" for v in joints()), end="\r", flush=True)
                time.sleep(0.1)
        elif a.cmd == "programs":
            print(*programs(), sep="\n")
        elif a.cmd == "alarms":
            print(*alarms(10), sep="\n")
        elif a.cmd == "poses":
            for name, pose in load_poses().items():
                print(f"{name:15}", pose)
        elif a.cmd == "run":
            run(a.name)
            print(f"{a.name} finished")
        elif a.cmd == "move":
            move(a.angles, a.speed)
            print("arrived at", joints())
        elif a.cmd == "jog":
            jog(a.joint, a.delta, a.speed)
            print("arrived at", joints())
        elif a.cmd == "save":
            print(f"saved {a.name}:", save_pose(a.name))
        elif a.cmd == "goto":
            goto(a.name, a.speed)
            print("arrived at", joints())
    except KeyboardInterrupt:
        print()
    except (OSError, ValueError, RuntimeError, TimeoutError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
