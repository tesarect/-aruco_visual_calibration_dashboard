#!/usr/bin/env python3
"""Pull the live, fully-expanded URDF from /robot_state_publisher's
robot_description parameter, resolve every package:// mesh reference to a
real file via `ros2 pkg prefix`, copy those meshes into
app/public/robot/meshes/<package>/..., and rewrite the URDF's mesh URIs to
the matching /robot/meshes/<package>/... paths the browser can fetch.

Run this with the simulation already up (robot_state_publisher must be
alive and have robot_description set). See ../README.md.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
APP_PUBLIC_ROBOT_DIR = SCRIPT_DIR.parent / "app" / "public" / "robot"
MESH_URI_RE = re.compile(r'package://([^/]+)/([^"\']+)')


def run(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        sys.exit(f"Command failed: {' '.join(cmd)}\n{result.stderr}")
    return result.stdout


def get_robot_description() -> str:
    out = run(["ros2", "param", "get", "/robot_state_publisher", "robot_description"])
    # `ros2 param get` prefixes the value with "String value is:\n"
    prefix = "String value is:"
    if prefix in out:
        out = out.split(prefix, 1)[1]
    return out.strip()


def pkg_prefix(pkg_name: str) -> Path:
    out = run(["ros2", "pkg", "prefix", pkg_name]).strip()
    return Path(out)


def resolve_and_copy_meshes(urdf_text: str) -> str:
    pkg_prefix_cache = {}
    meshes_dir = APP_PUBLIC_ROBOT_DIR / "meshes"
    meshes_dir.mkdir(parents=True, exist_ok=True)

    def replace(match: re.Match) -> str:
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

        return f"/robot/meshes/{pkg_name}/{rel_path}"

    return MESH_URI_RE.sub(replace, urdf_text)


def main():
    print("Fetching /robot_state_publisher robot_description ...")
    urdf_text = get_robot_description()
    if not urdf_text:
        sys.exit(
            "robot_description is empty. Is the simulation running and has "
            "robot_state_publisher started?"
        )

    print("Resolving package:// mesh URIs and copying mesh files ...")
    rewritten = resolve_and_copy_meshes(urdf_text)

    APP_PUBLIC_ROBOT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = APP_PUBLIC_ROBOT_DIR / "robot.urdf"
    out_path.write_text(rewritten)
    print(f"Wrote {out_path}")
    print(f"Meshes copied under {APP_PUBLIC_ROBOT_DIR / 'meshes'}")


if __name__ == "__main__":
    main()