set -eu
cd "$(dirname "$0")"
if [ ! -d upstream/src ]; then
  git init -q upstream
  git -C upstream fetch -q --depth=1 --filter=blob:none https://github.com/doop-design/doop.git 1c72db0d48961e15fb77595cf3f746c711bda20f
  git -C upstream sparse-checkout set src shared
  git -C upstream checkout -q --detach FETCH_HEAD
fi
(cd upstream && bun install --frozen-lockfile --ignore-scripts)
if [ ! -e node_modules ]; then
  ln -s upstream/node_modules node_modules
fi
./node_modules/.bin/vite build
