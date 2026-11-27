# Сборка и публикация демо

Команды выполняются из корня репозитория. Для сборки нужны Node.js 26, npm 12 и фотографии из Git LFS.

```sh
git lfs pull
npm ci --prefix design
npm audit --prefix design --audit-level=low
npm run build --prefix design
```

Сборка находится в `design/dist/`. Команда `npm run dev --prefix design` открывает сервер для разработки, а `npm run preview --prefix design` раздаёт локальную сборку.

## Публикация

На рабочем компьютере нужны [rclone](https://rclone.org/install/) и SSH-доступ к VPS по имени `vpn`. На сервере [Caddy](Caddyfile) раздаёт файлы из `/srv/prochay-demo/current/` по HTTP.

Для ревью укажи номер PR. Следующая команда публикует версию PR № 10.

```sh
node design/publish/publish.ts --review 10
```

Каталог этой версии открывается по адресу `http://157.22.181.155/c/review-10/proto/` без входа в аккаунт.

После слияния опубликуй актуальную ветку `main`.

```sh
node design/publish/publish.ts
```

Публикация собирает демо во временной папке и передаёт файлы через `rclone sync` по SFTP. Устаревшие файлы в выбранной версии удаляются. При обрыве передачи повтори команду. Публикация `main` сохраняет все демо для ревью.

После публикации проверь открытие каталога и карточки товара в [публичном демо](http://157.22.181.155/). После публикации слитого PR или закрытия PR без слияния удали на VPS его папку `/srv/prochay-demo/current/c/review-<номер PR>/`.
