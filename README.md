# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
# Личный кабинет ПСПбГМУ

## Запуск production-связки локально

1. Установите и запустите Docker Desktop.
2. Скопируйте `.env.example` в `.env` и задайте секреты MySQL и администратора.
3. Выполните `docker-compose -p spbgmu up --build`.
4. Откройте `http://localhost:3000`.

Сервисы: MySQL 8.4 (`mysql`), Node API (`api:4000`) и web через Nginx gateway (`:3000`). В production TLS должен завершаться на внешнем reverse-proxy/load-balancer; для HTTPS установите `COOKIE_SECURE=true`.

Регистрация студентов, даты комиссии и подтверждения доступны роли `admin`. Роль `viewer` получает отдельный логин и пароль и работает в режиме только просмотра. Студент получает отдельный логин, пароль и email, видит только собственный прогресс, заполняет анкету, ответы и даты, отмечает этапы и общается с комиссией.

## Роли и маршрут

- В `.env` можно задать `VIEWER_LOGIN` и `VIEWER_PASSWORD`: такой пользователь создаётся при первом запуске базы.
- Администратор может создать дополнительные доступы наблюдателей из панели.
- Маршрут подготовительного отделения для иностранных граждан содержит 23 этапа из файла `Marshrut_k_zachisleniyu.docx`.
- В карточке студента администратор проставляет дату комиссии и подтверждение этапа; студент видит свои даты, вводит ответы и ставит собственную отметку.
- Сообщения хранятся в MySQL и доступны только участникам диалога.
- Переключатель RU/EN меняет интерфейс и отдельные тексты маршрута; интерфейс адаптирован для телефона.

## Чат и email-уведомления (для системного администратора)

- Раздел «Сообщения» доступен студенту в меню. Администраторы открывают список диалогов в своём разделе «Сообщения» или из таблицы студентов. Наблюдатель читает переписку без права отправки.
- Открытый чат обновляется каждые 3 секунды, список диалогов — каждые 5 секунд. История хранится в MySQL; студент не может открыть чужой диалог.
- После ответа администратора уведомление записывается в `message_email_notifications` в одной транзакции с сообщением. Сбой или отсутствие SMTP не мешает чату. Текст переписки и вложения в письмо не включаются.
- Адрес берётся из поля «Электронная почта» в анкете; если анкета ещё не содержит этого поля — из адреса, указанного при регистрации. Сохранение email в анкете обновляет контакт в аккаунте. Некорректный/пустой адрес не используется для отправки.

Настройку почты выполняет системный администратор университета напрямую в `.env`, без передачи секретов через чат или Git:

1. Уточнить у почтовой службы SMTP-хост, порт, разрешённого отправителя и способ авторизации (учётная запись или relay по IP).
2. Заполнить `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` (один email без отображаемого имени), `SMTP_USER`, `SMTP_PASSWORD` и `APP_URL` (внешний HTTPS-адрес сервиса). Для SMTPS на порту 465 установить `SMTP_SECURE=true`; для STARTTLS на порту 587 — `false`. STARTTLS обязателен, проверка сертификата не отключается. Для relay без авторизации оставить `SMTP_USER` и `SMTP_PASSWORD` пустыми.
3. Пересоздать **только API** после изменения `.env`: `docker compose -p spbgmu-local up -d --no-deps --force-recreate api` (на сервере использовать имя своего Compose-проекта и его файлы конфигурации). Затем пересоздать gateway, если Nginx продолжает обращаться по старому IP контейнера: `docker compose -p spbgmu-local up -d --no-deps --force-recreate gateway`. При локальном доступе по Wi-Fi сохранить используемый LAN-overlay.
4. Отправить тестовый ответ **в специально созданный тестовый аккаунт со своим email**. В чате администратора проверить статус «Уведомление принято почтовым сервером», затем проверить ящик и спам. Статус SMTP означает приём сервером, а не гарантированную доставку во входящие.

До настройки SMTP уведомления остаются в очереди и не теряются при перезапуске. После подключения будут отправлены и накопленные уведомления. Очередь проверяется раз в 10 секунд; при ошибках выполняется до 10 попыток с увеличивающимся интервалом (до часа). Исчерпанные попытки отмечаются `failed`; администратору сервера следует проверить настройки/коды ошибок и повторно поставить нужные записи в очередь после исправления причины. Логирование SMTP-паролей, тела переписки и полных SMTP-ответов отключено. После аварийного завершения отправки возможна повторная доставка одного уведомления (at-least-once).

Проверки без реальной отправки писем: `node --test tests/mail-notifications.test.mjs`; интеграционные проверки в локальном Docker: `docker compose -p spbgmu-local exec -T -e CHAT_TEST_LOCAL=1 -e CHAT_TEST_ORIGIN=http://gateway api node --test tests/messages.test.mjs`. Тесты используют только временные аккаунты и подставной SMTP-транспорт; существующим студентам письма не отправляются.
