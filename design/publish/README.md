# Публикация демо

Демо показывает принятый в `main` холст Doop. После слияния дизайн-PR обнови локальную ветку `main`. Команды выполняются из корня проекта при работающем Doop.

Для сборки плеера нужны Node.js и Bun. На рабочем Mac Bun доступен через `export PATH="$PWD/.local/doop-server/bin:$PATH"`. Собери плеер при первой публикации и при изменениях в `design/publish/player/`.

```sh
(cd design/publish/player && bun install --frozen-lockfile && bun run build)
```

Bun получает исходники Doop из GitHub по ревизии в [package.json](player/package.json). Версии зависимостей зафиксированы в [bun.lock](player/bun.lock). Для публикации изменений каталога используй готовую сборку.

```sh
(
  set -e
  release_dir=$(mktemp -d)
  trap 'rm -rf "$release_dir"' EXIT
  node design/publish/export.ts "$release_dir" --cookie-file .local/doop-server/private/cookie-header
  bash scripts/publish-demo.sh "$release_dir"
)
```

Экспорт использует локальную сборку штатного плеера. Её исходники, лицензия и команда сборки доступны в разделе `/source/` опубликованного демо. Авторизация Doop нужна для чтения холста на рабочем компьютере.

На сервере `ssh vpn` Caddy обслуживает `/srv/prochay-demo/current` по [конфигурации сайта](Caddyfile). Скрипт переключает эту ссылку после загрузки файлов, сверяет стартовую страницу и данные каталога через HTTP и возвращает предыдущую версию при ошибке. На сервере остаются две последние успешные публикации. После обновления проверь каталог и переход в карточку по публичной ссылке из [дизайн-дока](../spec.md).
