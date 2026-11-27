#!/usr/bin/env bash
set -euo pipefail

bundle=${1:-.local/http-demo/public}
for file in index.html canvas.json; do
    if [[ ! -s "$bundle/$file" ]]; then
        printf 'Missing %s/%s\n' "$bundle" "$file" >&2
        exit 1
    fi
done
if [[ -n $(find "$bundle" ! -type d ! -type f -print -quit) ]]; then
    printf 'The export must contain only regular files and directories.\n' >&2
    exit 1
fi

export COPYFILE_DISABLE=1
tar --no-xattrs -C "$bundle" -czf - . | ssh -T -o BatchMode=yes -o StrictHostKeyChecking=yes vpn '
    set -eu
    cd /srv/prochay-demo
    exec 9>.publish.lock
    flock -x 9
    test ! -e current || test -L current
    previous=$(readlink current || true)
    scratch=$(mktemp -d .publish.XXXXXXXX)
    release=$(mktemp -d releases/demo.XXXXXXXX)

    point_to() {
        ln -s "$1" "$scratch/link"
        mv -Tf "$scratch/link" current
    }
    cleanup() {
        if test "$?" -ne 0; then
            if test "$(readlink current || true)" = "$release"; then
                if test -n "$previous"; then
                    point_to "$previous"
                else
                    rm current
                fi
            fi
            rm -rf "$release"
        fi
        rm -rf "$scratch"
    }
    trap cleanup EXIT
    trap "exit 1" HUP INT TERM

    tar -xzf - -C "$release" --no-same-owner
    chmod -R u+rwX,go+rX,go-w "$release"
    point_to "$release"
    for file in index.html canvas.json; do
        path=$file
        if test "$file" = index.html; then path=""; fi
        curl --noproxy "*" --fail --silent --show-error --max-time 30 --output "$scratch/response" "http://127.0.0.1/$path"
        cmp "$scratch/response" "$release/$file"
    done

    for old in releases/demo.*; do
        if test "$old" != "$release" && test "$old" != "$previous"; then
            rm -rf "$old"
        fi
    done
    printf "Published %s\n" "$release"
'
