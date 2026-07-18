#!/usr/bin/env python3
"""Pull the live, fully-expanded URDF from the /robot_description topic,
resolve every package:// and file:// mesh reference to a real file on disk
(package:// via `ros2 pkg prefix`, file:// by using the already-absolute
path directly — different xacro sources use one or the other; this
project's UR3e description emits resolved file:// paths, while the RG2
gripper/camera descriptions emit package:// URIs), copy those meshes into
app/public/robot/meshes/<package>/..., and rewrite the URDF's mesh URIs to
the matching /robot/meshes/<package>/... paths the browser can fetch.

Reads /robot_description as a topic (std_msgs/String, typically published
transient-local), not a /robot_state_publisher parameter — this project's
launch setup doesn't run a node named /robot_state_publisher at all
(confirmed via `ros2 node list`), even though /robot_description is
actively published. Deliberately reads from the live sim/real robot rather
than running xacro locally — this project has already hit a real bug class
where colliding xacro arg names silently produced a structurally wrong robot
(wrong gripper); reading the already-expanded URDF the live robot is actually
using avoids that risk entirely, at the one-time cost of needing the sim/real
robot briefly up when (re-)extracting.

Subscribes directly via rclpy rather than shelling out to `ros2 topic
echo` — that command reformats/truncates long string fields for terminal
display (confirmed: it silently mangled the multi-KB URDF into a few
truncated lines), so it's unsuitable for extracting an exact large string
payload. Run this with the simulation/real robot connection already up.
See ../README.md.
"""
import argparse
import hashlib
import re
import shutil
import subprocess
import sys
from pathlib import Path

import rclpy
from rclpy.node import Node
from rclpy.qos import QoSDurabilityPolicy, QoSProfile, QoSReliabilityPolicy
from std_msgs.msg import String

SCRIPT_DIR = Path(__file__).resolve().parent
APP_PUBLIC_ROBOT_ROOT = SCRIPT_DIR.parent / "app" / "public" / "robot"
SUBSCRIBE_TIMEOUT_SEC = 5.0


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"Command failed: {' '.join(cmd)}\n{result.stderr}")
    return result.stdout


def get_robot_description() -> str:
    # /robot_description is conventionally published with transient-local
    # durability (so a late subscriber still gets the one retained
    # message) — match that here, otherwise this subscriber may never
    # receive anything if it starts after the publisher already sent it.
    qos = QoSProfile(
        depth=1,
        reliability=QoSReliabilityPolicy.RELIABLE,
        durability=QoSDurabilityPolicy.TRANSIENT_LOCAL,
    )

    rclpy.init()
    try:
        node = Node("extract_urdf_subscriber")
        received = {}

        def on_message(msg: String) -> None:
            received["data"] = msg.data

        node.create_subscription(String, "/robot_description", on_message, qos)

        end_time = node.get_clock().now().nanoseconds + int(SUBSCRIBE_TIMEOUT_SEC * 1e9)
        while "data" not in received and node.get_clock().now().nanoseconds < end_time:
            rclpy.spin_once(node, timeout_sec=0.2)

        node.destroy_node()
        if "data" not in received:
            sys.exit(
                f"Timed out after {SUBSCRIBE_TIMEOUT_SEC}s waiting for "
                "/robot_description. Is the simulation/real robot connection up?"
            )
        return received["data"].strip()
    finally:
        rclpy.shutdown()


def pkg_prefix(pkg_name: str) -> Path:
    out = run(["ros2", "pkg", "prefix", pkg_name]).strip()
    return Path(out)


# Some xacro sources (e.g. Universal_Robots_ROS2_Description's ur_macro.xacro,
# which builds mesh paths via `find-pkg-share` at xacro-expansion time rather
# than leaving a package:// URI in the URDF) emit resolved absolute
# `file://` paths instead of `package://` URIs. Both need resolving to a
# browser-servable /robot/meshes/... path — package:// via `ros2 pkg
# prefix`, file:// by just copying from the already-absolute path.
PACKAGE_URI_RE = re.compile(r'package://([^/]+)/([^"\']+)')
FILE_URI_RE = re.compile(r'file://(/[^"\']+)')


def resolve_and_copy_meshes(urdf_text: str, robot_dir: Path) -> str:
    pkg_prefix_cache = {}
    meshes_dir = robot_dir / "meshes"
    meshes_dir.mkdir(parents=True, exist_ok=True)

    def replace_package_uri(match: re.Match) -> str:
        pkg_name, rel_path = match.group(1), match.group(2)
        if pkg_name not in pkg_prefix_cache:
            pkg_prefix_cache[pkg_name] = pkg_prefix(pkg_name)
        prefix = pkg_prefix_cache[pkg_name]

        # Installed share layout: <prefix>/share/<pkg_name>/<rel_path>
        src = prefix / "share" / pkg_name / rel_path
        if not src.exists():
            sys.exit(f"Mesh not found on disk: {src} (from package://{pkg_name}/{rel_path})")

        dest = meshes_dir / pkg_name / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)

        # Relative, not root-absolute — robot.urdf lives at
        # public/robot/robot.urdf and urdf-loader resolves mesh filenames
        # relative to the URDF's own directory by default, so this must be
        # "meshes/..." (relative to public/robot/), not "/robot/meshes/..."
        # (root-absolute). A root-absolute path resolves against the
        # domain root under the rosject's /<SLOT_PREFIX>/webpage/ proxy
        # prefix and 404s — nginx's HTML error page then gets fed to
        # ColladaLoader as if it were XML, which is exactly the "invalid
        # element name" parse error this fixes. Same bug class as
        # App.tsx's rosject-config.json fetch and vite.config.ts's
        # base:"./" fix — see README.md.
        return f"meshes/{pkg_name}/{rel_path}"

    def replace_file_uri(match: re.Match) -> str:
        src = Path(match.group(1))
        if not src.exists():
            sys.exit(f"Mesh not found on disk: {src} (from file://{src})")

        # Re-derive a package-scoped relative path from .../share/<pkg>/<rest>
        # so these land in the same /robot/meshes/<pkg>/<rest> shape as
        # package:// meshes, instead of flattening/colliding by filename.
        parts = src.parts
        if "share" in parts:
            share_idx = parts.index("share")
            pkg_name = parts[share_idx + 1]
            rel_path = Path(*parts[share_idx + 2:])
        else:
            pkg_name = "_file"
            rel_path = Path(src.name)

        dest = meshes_dir / pkg_name / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dest)

        # Relative, not root-absolute — robot.urdf lives at
        # public/robot/robot.urdf and urdf-loader resolves mesh filenames
        # relative to the URDF's own directory by default, so this must be
        # "meshes/..." (relative to public/robot/), not "/robot/meshes/..."
        # (root-absolute). A root-absolute path resolves against the
        # domain root under the rosject's /<SLOT_PREFIX>/webpage/ proxy
        # prefix and 404s — nginx's HTML error page then gets fed to
        # ColladaLoader as if it were XML, which is exactly the "invalid
        # element name" parse error this fixes. Same bug class as
        # App.tsx's rosject-config.json fetch and vite.config.ts's
        # base:"./" fix — see README.md.
        return f"meshes/{pkg_name}/{rel_path}"

    urdf_text = PACKAGE_URI_RE.sub(replace_package_uri, urdf_text)
    urdf_text = FILE_URI_RE.sub(replace_file_uri, urdf_text)
    return urdf_text


def hash_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def hash_file_path(robot_dir: Path) -> Path:
    return robot_dir / ".robot_description.sha256"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--env",
        choices=["sim", "real"],
        required=True,
        help=(
            "Which robot.urdf/meshes tree to write into — sim (RG2 gripper) "
            "and real (Robotiq 85 gripper) have structurally different "
            "kinematic chains/link names, so they're kept as separate asset "
            "trees (public/robot/sim/, public/robot/real/) rather than one "
            "shared robot.urdf that gets silently overwritten by whichever "
            "environment was extracted last."
        ),
    )
    parser.add_argument(
        "--check-stale",
        action="store_true",
        help=(
            "Don't extract — just fetch the live /robot_description, hash "
            "it, and compare against the hash saved next to the cached "
            "robot.urdf from the last extraction for this env. Exits 0 "
            "(cache is current, nothing to do) or 1 (stale/missing cache, "
            "re-extraction needed) — no other output on stdout, so a "
            "calling shell script can branch on the exit code alone. Used "
            "by setup_rosject.sh to auto-detect a structural robot_description "
            "change (e.g. an SRDF chain edit) without requiring the caller "
            "to remember --force-extract-urdf by hand."
        ),
    )
    return parser.parse_args()


def check_stale(env: str) -> None:
    robot_dir = APP_PUBLIC_ROBOT_ROOT / env
    saved_hash_path = hash_file_path(robot_dir)
    cached_urdf = robot_dir / "robot.urdf"

    if not cached_urdf.exists() or not saved_hash_path.exists():
        sys.exit(1)  # nothing cached yet — treat as stale

    urdf_text = get_robot_description()
    if not urdf_text:
        sys.exit(
            "robot_description is empty. Is the simulation/real robot "
            "connection running and is /robot_description being published?"
        )

    live_hash = hash_text(urdf_text)
    saved_hash = saved_hash_path.read_text().strip()
    sys.exit(0 if live_hash == saved_hash else 1)


def main():
    args = parse_args()

    if args.check_stale:
        check_stale(args.env)
        return

    robot_dir = APP_PUBLIC_ROBOT_ROOT / args.env

    print(f"Fetching /robot_description topic (env={args.env}) ...")
    urdf_text = get_robot_description()
    if not urdf_text:
        sys.exit(
            "robot_description is empty. Is the simulation/real robot "
            "connection running and is /robot_description being published?"
        )

    print("Resolving package:// mesh URIs and copying mesh files ...")
    rewritten = resolve_and_copy_meshes(urdf_text, robot_dir)

    robot_dir.mkdir(parents=True, exist_ok=True)
    out_path = robot_dir / "robot.urdf"
    out_path.write_text(rewritten)
    hash_file_path(robot_dir).write_text(hash_text(urdf_text))
    print(f"Wrote {out_path}")
    print(f"Meshes copied under {robot_dir / 'meshes'}")


if __name__ == "__main__":
    main()