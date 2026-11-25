# FANUC arm control from a Pi or laptop

Control the FANUC robot arm (R-30iA controller, M-16iB/10L / ARC Mate 120iB/10L) from a
Raspberry Pi or laptop over Ethernet. Tested on 2026-11-25 in T1: reading positions, starting
programs and joint moves of J1 and J2.

| File | What it is |
|---|---|
| `fanuc.py` | Python client and command line (standard library only, Python 3.9+) |
| `PI_DISP.LS` | Dispatcher: TP program that waits for commands from the Pi |
| `PI_MOVE.LS` | Joint move to angles the Pi wrote in registers |
| `PI_PING.LS` | Test program without motion (only adds 1 to R[100]) |
| `test_fanuc.py` | Offline check of the joint-limit logic (`python3 test_fanuc.py`) |
| `poses.json` | Saved poses, created by `fanuc.py save` |

## How it works

```
Pi / laptop                         R-30iA controller (10.0.6.10)
-----------                         -----------------------------
fanuc.py --HTTP: write R[100]=n-->  PI_DISP (keeps running, waits for R[100] <> 0)
                                      R[101] = n           (busy)
                                      CALL program n       (e.g. TEST, PI_MOVE)
                                      R[101] = 0, R[100] = 0 (done)
fanuc.py <--HTTP: read R[100]-----
```

The Pi never starts a program directly. It writes a **number in register R[100]**.
`PI_DISP`, which keeps running on the controller, sees that number, calls the matching
program and sets R[100] back to 0 when that program has finished. `fanuc.py` waits for
that 0.

Why this way: on this controller, starting programs over the network is blocked.

- **Telnet** (`telnet 10.0.6.10`, login `KCL`, password `b`) logs in but does not answer
  any command.
- **HTTP KCL** (`http://10.0.6.10/KCL/...`) does answer read commands, but refuses `RUN` with
  `HOST-238 Protected KCL command`, with or without the password.
- **Writing registers** over HTTP does work, so registers are the "mailbox".

### Registers

| Register | Meaning | Written by |
|---|---|---|
| R[100] | requested program number; 0 = nothing / done | Pi writes n, `PI_DISP` sets 0 |
| R[101] | number of the running program; 0 = idle | `PI_DISP` |
| R[110] | speed % for `PI_MOVE` | Pi |
| R[111]..R[116] | target angles J1..J6 in degrees for `PI_MOVE` | Pi |
| PR[1] | used internally by `PI_MOVE` | `PI_MOVE` |

Keep these registers free in other programs.

### What `fanuc.py` sends (all plain HTTP to port 80)

| Action | URL |
|---|---|
| Write register | `/KAREL/ComSet?sValue=<value>&sIndx=<n>&sRealFlag=-1&sFc=2` (`sRealFlag=1` for decimals) |
| Read registers | `/MD/NUMREG.VA` |
| Current position | `/MD/CURPOS.DG` (about 12 reads per second) |
| Is `PI_DISP` running? | `/MD/PRGSTATE.DG` |
| Alarms | `/MD/ERRALL.LS` |
| Read-only KCL | `/KCL/SHOW%20VAR%20$VERSION`, `/KCL/DIRECTORY%20MD:*.TP` |

Programs are uploaded over **FTP** (port 21, anonymous). FTP and the web server have no
password: **keep the robot on its own network**, never on a shared LAN.

## Setup

### 1. Network

Controller: **10.0.6.10** (static, set on the pendant under MENU → SETUP → Host Comm → TCP/IP).

Give the laptop or Pi a fixed address in the same range, without a gateway:

```bash
# laptop (NetworkManager); use your own adapter name from `ip -br link`
nmcli con add type ethernet ifname enx207bd2929aef con-name fanuc-arm \
  ipv4.method manual ipv4.addresses 10.0.6.8/24 ipv4.never-default yes ipv6.method disabled
nmcli con up fanuc-arm
```

On the Pi, use for example `10.0.6.9/24` (Raspberry Pi OS Bookworm also uses NetworkManager,
so the same command works with `ifname eth0`). Test with `ping 10.0.6.10` and
`python3 fanuc.py status`. If you are connecting directly with a cable and the laptop must stay
connected too, use a switch.

If the controller has a different IP: `FANUC_IP=10.x.x.x python3 fanuc.py status`.

### 2. Programs on the controller

Upload once (already done on 2026-11-25):

```bash
curl -T PI_DISP.LS ftp://10.0.6.10/
curl -T PI_MOVE.LS ftp://10.0.6.10/
curl -T PI_PING.LS ftp://10.0.6.10/
```

Check with `python3 fanuc.py programs` and `python3 fanuc.py alarms` (no `ASBN` errors).

### 3. Start `PI_DISP` (every session)

In **T1** (key switch on the cabinet), on the teach pendant:

1. Lower the override: **−%** to 10% (top right of the screen).
2. **SELECT** → `PI_DISP` → **ENTER** (top line shows `PI_DISP LINE 0`).
3. OFF/ON knob → **ON**.
4. Hold the **deadman switch** halfway in.
5. **RESET** (Fault lamp goes out).
6. Hold **SHIFT**, press **FWD** → the Busy/Run lamp lights up.
7. **Keep holding SHIFT and the deadman.** Release = the arm stops immediately.

`python3 fanuc.py status` should now show `dispatcher: RUNNING`.

Without a person at the pendant (the final setup with the Pi): **AUTO** mode, TP OFF, start
`PI_DISP` once with CYCLE START on the cabinet. Only do this with a working enclosure and
someone at the E-stop. Not tested yet.

## Commands

```bash
python3 fanuc.py status                 # dispatcher, R[100]/R[101], joints, alarms
python3 fanuc.py watch                  # live joint angles (Ctrl-C)
python3 fanuc.py programs               # TP programs on the controller
python3 fanuc.py alarms                 # last 10 alarms
python3 fanuc.py run TEST               # run a program from PROGRAMS
python3 fanuc.py move 0 -25 -17 -6 -10 -67 --speed 5   # joint move to J1..J6
python3 fanuc.py jog 6 10 --speed 5     # J6 +10 degrees from where it is now
python3 fanuc.py save pickup            # save the current position as "pickup"
python3 fanuc.py goto pickup            # back to "pickup"
python3 fanuc.py poses                  # list saved poses
```

From your own Python code (on the Pi):

```python
import fanuc

print(fanuc.joints())                  # [J1, ..., J6] in degrees
fanuc.run("TEST")                      # blocks until TEST has finished
fanuc.move([0, -25, -17, -6, -10, -67], speed=5)
fanuc.jog(1, -15)
fanuc.goto("pickup")
```

All functions raise an exception on problems (`PI_DISP` not running, busy, limit exceeded,
timeout, `PI_DISP` stopped during a move); `fanuc.py` then prints `error: ...`.

## Speed

The real speed = speed % in the program (`--speed`, max 30%) × the **override** on the pendant.
In T1 it is also limited to 250 mm/s. At 5% and a 10% override, J1 moved 170° in 22 s.

## Joint limits

Two layers; set both:

1. **In `fanuc.py`**: `JOINT_LIMITS` and `MAX_SPEED` at the top. Every `move`, `jog` and
   `goto` is checked before anything is sent. Only applies to this script.
2. **On the controller**: MENU → 0 NEXT → 6 SYSTEM → F1 [TYPE] → **Axis Limits**. Applies
   to everything, including jogging on the pendant. Change a value: cursor on LOWER/UPPER,
   type a number (− first for negative), ENTER. Then **switch the controller off and on**.

Factory values (also the current values in both): J1 ±170, J2 −90..160, J3 −170..285,
J4 ±200, J5 ±140, J6 ±450 degrees. Find good values by jogging in JOINT mode (COORD until
JOINT is shown) to the edge of the free space and reading the angle (`fanuc.py watch` or
POSN). Keep `JOINT_LIMITS` equal to or tighter than the controller.

After changing `JOINT_LIMITS`, run `python3 test_fanuc.py` (adjust the test values if your limits
make them valid).

## Adding a program that the Pi can start

Example: a program `PAKOP` that the Pi should start as number 4.

1. **Make the program** on the pendant (SELECT → F2 CREATE), or as an `.LS` file (see below)
   and upload it: `curl -T PAKOP.LS ftp://10.0.6.10/`.
2. **Add it to `PI_DISP.LS`**, above `R[101]=0`:
   ```
     12:  IF R[101]=4,CALL PAKOP ;
   ```
   Renumber the lines after it (the numbers in front of `:` must be consecutive).
3. **Upload `PI_DISP.LS` again**: abort `PI_DISP` on the pendant first (FCTN → 1 ABORT (ALL)),
   then `curl -T PI_DISP.LS ftp://10.0.6.10/`, then `python3 fanuc.py alarms` to check for errors.
4. **Add it to `fanuc.py`**: in `PROGRAMS`, `"PAKOP": 4`.
5. Start `PI_DISP` again and test: `python3 fanuc.py run PAKOP`.

Numbers 1, 2, 3 and 9 are taken (`PI_PING`, `TEST`, `CLAUDE_J6`, `PI_MOVE`). Use numbers
greater than 0; 0 means "nothing".

## Writing `.LS` programs

Minimal joint program (two points, joint angles):

```
/PROG  MY_PROG
/ATTR
COMMENT		= "short description";
DEFAULT_GROUP	= 1,*,*,*,*;
/MN
   1:J P[1] 10% FINE    ;
   2:J P[2] 10% FINE    ;
/POS
P[1]{
   GP1:
	UF : 0, UT : 0,	
	J1=     0.000 deg,	J2=   -25.000 deg,	J3=   -17.000 deg,
	J4=    -6.000 deg,	J5=   -10.000 deg,	J6=   -67.000 deg
};
P[2]{
   GP1:
	UF : 0, UT : 0,	
	J1=    10.000 deg,	J2=   -25.000 deg,	J3=   -17.000 deg,
	J4=    -6.000 deg,	J5=   -10.000 deg,	J6=   -67.000 deg
};
/END
```

What we learned:

- **Upload to the FTP root** (`ftp://10.0.6.10/`), not to `md:` (that fails with curl error 18).
- After every upload, run `python3 fanuc.py alarms`. Load errors show up as `ASBN-002 Error occurred
  during load` / `ASBN-009 on line X, column Y` / `ASBN-022 Out of range`. A tab counts as
  8 columns.
- **The tool frame (`UT`) must match the active tool frame.** The active one is now **0** (see `CURPOS.DG`:
  `Tool #: 0`). On 2026-11-04 `CLAUDE_J5` with `UT : 1` stopped with
  `INTP-251 Invalid utool number`. Use `UT : 0`, or put `UTOOL_NUM=0 ;` at the top of the
  program.
- **Absolute points store all joints.** If the arm is somewhere else, the first move goes all
  the way there. `CLAUDE_J5`/`CLAUDE_J6` therefore start with a large swing from the 2026-11-04
  pose. For moves "from where the arm is now", use `fanuc.py jog`/`move` instead.
- A program without motion: `DEFAULT_GROUP = *,*,*,*,*;` (like `PI_PING`).
- `J PR[1] R[110]% FINE` (speed from a register) works on this firmware (V7.70P/39).
- Replacing an existing program: abort it first. (Not tested what happens if you upload
  over a running program; aborting first is the safe choice.)

## Troubleshooting

| Symptom | Cause / solution |
|---|---|
| `error: PI_DISP is not running` | Start `PI_DISP` (see Setup step 3). |
| `error: PI_DISP is busy` while nothing is running | R[100]/R[101] still has an old number from an interrupted run. Starting `PI_DISP` again resets them. |
| `PI_DISP stopped while running ...` | Deadman or SHIFT released, E-stop, or an alarm. See `fanuc.py alarms`, RESET, start again. |
| `SRVO-003 Deadman switch released` | Normal when nobody is holding the deadman. |
| `timed out` / no connection | Laptop not on 10.0.6.x (`ip -br addr`), cable, or a different controller IP. |
| Traffic goes over WiFi | No 10.0.6.x address on the Ethernet adapter: `ip route get 10.0.6.10` must show the Ethernet adapter. |
| `INTP-251` / `INTP-253` | Tool frame mismatch, see "Writing `.LS` programs". |
