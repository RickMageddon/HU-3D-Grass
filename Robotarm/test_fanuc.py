"""Offline checks for the limit logic (no robot needed): python3 test_fanuc.py"""
import fanuc

ok = [0, 0, 0, 0, 0, 0]
fanuc.check_target(ok, 10)
for bad, speed in [([171, 0, 0, 0, 0, 0], 10), ([0, -91, 0, 0, 0, 0], 10),
                   ([0, 0, 0, 0, 141, 0], 10), ([0] * 5, 10), (ok, 0), (ok, fanuc.MAX_SPEED + 1)]:
    try:
        fanuc.check_target(bad, speed)
    except ValueError:
        continue
    raise AssertionError(f"accepted {bad} at {speed}%")
print("ok")
