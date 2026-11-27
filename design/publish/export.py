import argparse
import json
import os
import re
import shutil
import tarfile
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, urlopen

DESIGN = Path(__file__).resolve().parents[1] / "doop"
ASSET = re.compile(r"/a/([A-Za-z0-9_-]+\.(?:avif|gif|jpe?g|png|svg|webp))(?=[\"'\s)<>]|$)")
NAVIGATION = re.compile(r'data-doop-action="navigate:([^"]+)"')


def load(path):
    return json.loads(path.read_text())


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


def export(output, player, cookie):
    config = load(DESIGN / ".doop" / "config.json")
    manifest = load(DESIGN / "prototype.json")
    origin = config["server"].rstrip("/")
    if urlsplit(origin).scheme not in ("http", "https") or urlsplit(origin).hostname not in ("localhost", "127.0.0.1", "::1"):
        raise ValueError("The Doop session cookie may only be sent to a loopback server")
    api = origin + "/api/canvases/" + config["canvas"]
    request = Request(api, headers={"Cookie": cookie, "x-doop-composes-frames": "1"})
    with build_opener(NoRedirect).open(request, timeout=30) as response:
        source = json.load(response)
    if source["id"] != config["canvas"]:
        raise ValueError("Unexpected source canvas")
    selected = [row["frameId"] for row in manifest["frames"]]
    selected.extend(manifest.get("generated", {}).get("frames", {}).values())
    selected_ids = set(selected)
    start = manifest["nativeStartFrameId"]
    if len(selected_ids) != len(selected) or start not in selected_ids:
        raise ValueError("Invalid frame selection")
    by_id = {frame["id"]: frame for frame in source["frames"]}
    prefix = re.compile(re.escape(origin) + r'(?=/a/)')
    media = set()

    def local_assets(markup):
        markup = prefix.sub("", markup)
        if re.search(r'(?:https?:)?//(?!www\.w3\.org/)', markup):
            raise ValueError("Unbundled external URL in design")
        media.update(ASSET.findall(markup))
        return ASSET.sub(r"/media/\1", markup)

    frames = []
    for i, frame_id in enumerate(selected):
        frame = by_id[frame_id]
        html = local_assets(frame["html"])
        if re.search(r"<(?:script|iframe|object|embed)\b", html, re.I):
            raise ValueError("Unexpected executable content in " + frame_id)
        if not set(NAVIGATION.findall(html)) <= selected_ids:
            raise ValueError("Unpublished navigation destination in " + frame_id)
        frames.append(dict(id=frame_id, canvasId="prochay", pageId="demo", name=frame["name"],
                           x=i * 420, y=0, width=frame["width"], height=frame["height"],
                           createdAt=0, updatedAt=1, html=html))
    components = []
    for component in source["components"]:
        if component["head"]:
            raise ValueError("Review external component head before publishing")
        components.append(dict(id=component["id"], name=component["name"],
                               template=local_assets(component["template"]),
                               css=local_assets(component["css"]), head=[]))
    tokens = [{key: token[key] for key in ("name", "type", "value", "order") if key in token}
              for token in source.get("tokens", [])]
    canvas = dict(id="prochay", name="ПРОЧАЙ", role="view", pages=[dict(id="demo", name="ПРОЧАЙ", startFrameId=start)],
                  frames=frames, components=components, tokens=tokens, tokenThemes=source.get("tokenThemes", []))
    output.mkdir(parents=True, exist_ok=True)
    if any(output.iterdir()):
        raise ValueError("Choose an empty output directory")
    (output / "media").mkdir()

    def save_photo(name):
        address = origin + "/a/" + name
        with urlopen(address, timeout=30) as response:
            if not response.headers.get_content_type().startswith("image/"):
                raise ValueError("Unexpected image content for " + name)
            (output / "media" / name).write_bytes(response.read())

    with ThreadPoolExecutor(6) as pool:
        list(pool.map(save_photo, sorted(media)))
    (output / "canvas.json").write_text(json.dumps(canvas, ensure_ascii=False, separators=(",", ":")))
    dist = player / "dist"
    shutil.copytree(dist / "assets", output / "assets")
    index = (dist / "index.html").read_text()
    (output / "index.html").write_text(index)
    route = output / "c" / "prochay" / "proto"
    route.mkdir(parents=True)
    (route / "index.html").write_text(index)
    source_files(output / "source", player)
    print(f"{len(frames)} screens, {len(media)} images")


def source_files(directory, player):
    directory.mkdir()
    upstream = player / "upstream"
    shutil.copyfile(upstream / "LICENSE", directory / "LICENSE.txt")
    shutil.copyfile(player / "dist" / "licenses.txt", directory / "third-party.txt")
    with tarfile.open(directory / "player-source.tar.gz", "w:gz") as archive:
        for path in ("entry.jsx", "index.html", "vite.config.mts", "build.sh", "upstream/LICENSE",
                     "upstream/src", "upstream/shared", "upstream/tsconfig.json", "upstream/package.json", "upstream/bun.lock"):
            archive.add(player / path, arcname=path)
    (directory / "index.html").write_text(
        '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Плеер Doop</title>'
        '<h1>Плеер Doop</h1><p><a href="LICENSE.txt">GNU AGPL 3.0</a></p>'
        '<p><a href="third-party.txt">Лицензии зависимостей</a></p>'
        '<p><a href="https://github.com/doop-design/doop/tree/1c72db0d48961e15fb77595cf3f746c711bda20f">Doop</a></p>'
        '<p><a href="player-source.tar.gz">Исходный код плеера и сборки</a></p>'
        '<p>Для сборки выполните <code>bash build.sh</code> с установленными Bun и Node.js в распакованном каталоге.</p></html>'
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    parser.add_argument("--player", type=Path, required=True)
    parser.add_argument("--cookie-file", type=Path)
    args = parser.parse_args()
    cookie = args.cookie_file.read_text().strip() if args.cookie_file else os.environ["DOOP_COOKIE"]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.output.exists() and (not args.output.is_dir() or any(args.output.iterdir())):
        parser.error("output must be a new or empty directory")
    with tempfile.TemporaryDirectory(dir=args.output.parent) as temporary:
        staging = Path(temporary) / "site"
        export(staging, args.player, cookie)
        staging.replace(args.output)
