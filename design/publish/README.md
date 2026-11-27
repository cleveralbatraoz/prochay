# Публикация демо

Демо показывает принятый в `main` холст Doop. После слияния дизайн-PR обнови локальную ветку `main`. Команды выполняются из корня проекта при работающем Doop.

Для первой сборки плеера нужны Git, Node.js и Bun. Сборка проверена с Node.js 26.13.1 и Bun 1.3.10. На рабочем Mac для Bun можно выполнить `export PATH="$PWD/.local/doop-server/bin:$PATH"`. Повтори сборку при изменении файлов в `design/publish/player/`.

```sh
mkdir -p .local/http-demo/player
cp design/publish/player/* .local/http-demo/player/
bash .local/http-demo/player/build.sh
```

Скрипт получает закреплённую ревизию Doop и устанавливает зависимости по её `bun.lock`. Для публикации очередного состояния каталога используй готовый плеер.

```sh
(
  set -e
  release_dir=$(mktemp -d)
  trap 'rm -rf "$release_dir"' EXIT
  python3 design/publish/export.py "$release_dir" --player .local/http-demo/player --cookie-file .local/doop-server/private/cookie-header
  bash scripts/publish-demo.sh "$release_dir"
)
```

Экспорт использует локальную сборку штатного плеера. Её исходники, лицензия и команда сборки доступны в разделе `/source/` опубликованного демо. Авторизация Doop нужна для чтения холста на рабочем компьютере.

На сервере `ssh vpn` Caddy обслуживает `/srv/prochay-demo/current` по [конфигурации сайта](Caddyfile). Скрипт переключает эту ссылку после загрузки файлов, сверяет стартовую страницу и данные каталога через HTTP и возвращает предыдущую версию при ошибке. На сервере остаются две последние успешные публикации. После обновления проверь каталог и переход в карточку по публичной ссылке из [дизайн-дока](../spec.md).
