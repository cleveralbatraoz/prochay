# Публикация демо

На рабочем компьютере нужны Node.js 26 (от 26.13.1), npm 12, работающий Doop и SSH-доступ по имени `vpn`. Для передачи файлов установи rclone (на macOS — `brew install rclone`). [Установка rclone](https://rclone.org/install/)

На VPS Caddy раздаёт файлы сайта из `/srv/prochay-demo/current`. [Конфигурация Caddy](Caddyfile)

Команды выполняются из корня репозитория. Собери плеер при первом запуске и после изменений в `design/publish/player/`.

```sh
npm ci --prefix design/publish/player
npm audit --prefix design/publish/player --audit-level=low
npm run build --prefix design/publish/player
```

После публикации проверь поиск, корзину, избранное и возврат из карточки в гостевом Chromium. В `DEMO_URL` передай ссылку на каталог проверяемой версии. Для уже установленного Chromium укажи путь к исполняемому файлу в `CHROMIUM_PATH`. Браузер для Playwright также можно установить командой `npm exec --prefix design/publish/player -- playwright-core install chromium`.

```sh
DEMO_URL=http://157.22.181.155/ npm test --prefix design/publish/player
```

После слияния изменений макета обнови локальную ветку `main` и опубликуй её холст.

```sh
node design/publish/export.ts --publish --cookie-file .local/doop-server/private/cookie-header
```

Экспорт готовит плеер, экраны, фотографии и архив исходников во временной папке. Затем [rclone sync](https://rclone.org/commands/rclone_sync/) перезаписывает файлы выбранного демо по SFTP и удаляет устаревшие. Во время передачи сайт может показывать неполную сборку. При обрыве повтори команду. После публикации открой каталог и карточку товара по [публичной ссылке](http://157.22.181.155/).

Для ревью выполни команду из ветки макета, подставив номер PR вместо `8`. Адрес этой версии — `http://157.22.181.155/c/review-8/proto/`. Он открывает каталог без входа в Doop. У каждого PR своя папка, которую сохраняет публикация `main`.

```sh
node design/publish/export.ts --publish --review 8 --cookie-file .local/doop-server/private/cookie-header
```

После публикации слитого PR в `main` или закрытия PR без слияния удали его папку `/srv/prochay-demo/current/c/review-<номер PR>/`.

Для локальной копии укажи путь к пустой папке вместо `--publish`.

## Разовая настройка каталога на VPS

Если `current` — символическая ссылка на каталог в `releases/`, после успешной синхронизации перенеси этот каталог на место ссылки.

```sh
ssh vpn 'cd /srv/prochay-demo && dir=$(readlink current) && test -d "$dir" && unlink current && mv -T -- "$dir" current'
```

Открой демо и проверь переход из каталога в карточку товара. После проверки удали `/srv/prochay-demo/releases/` и `/srv/prochay-demo/.publish.lock`.
