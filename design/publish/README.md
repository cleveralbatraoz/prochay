# Сборка и публикация демо

## Локальное ревью PR

На компьютере владельца выбери ветку PR. Выполни команды из корня репозитория с Node.js 26, npm 12 и Git LFS.

```sh
git lfs pull
npm ci --prefix design
npm audit --prefix design --audit-level=low
npm run typecheck --prefix design
npm run build --prefix design
npm run preview --prefix design -- --host 127.0.0.1
```

Vite раздаёт собранные файлы из `design/dist/`. Ссылку для ревью возьми из строки `Local` в терминале. Она открывается на этом компьютере, пока работает превью.

## GitHub Actions

Для каждого PR в `main` GitHub Actions получает исходники и фотографии из Git LFS. Установка зависимостей, аудит, проверка типов и сборка выполняются отдельными шагами. Для слияния все шаги должны завершиться успешно.

При обновлении `main` GitHub Actions выполняет те же проверки и передаёт готовый `design/dist/` в окружение `github-pages` для публикации. [Демо на GitHub Pages](https://cleveralbatraoz.github.io/prochay/)
