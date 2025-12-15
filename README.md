# Casino (Vite + Express + Sequelize) – Render-ready

## Конфиг
- `.env` (или переменные окружения на Render):
  - `DATABASE_URL` (Postgres, Render/Neon URL)
  - `PORT` (по умолчанию 3001)
  - `JWT_SECRET`, `ADMIN_SECRET`
- Front build использует переменные `VITE_API_URL`, `VITE_WS_URL` при сборке.

## Команды
- Установка: `npm install --prefix backend && npm install --prefix frontend`
- Сборка: `npm run build --prefix backend` (соберёт сервер в `backend/dist` и клиент в `backend/dist/public`)
- Миграции: `npm run db:migrate --prefix backend`
- Запуск: `npm start --prefix backend` (читает собранный `dist/server.js`, отдаёт API + статику + SPA fallback)
- Dev backend: `npm run dev --prefix backend`

## Деплой на Render (Web Service, без Docker)
1) Root directory: `backend`
2) Build command: `npm install && npm --prefix ../frontend install && npm run build`
3) Start command: `npm start`
4) Env vars: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_SECRET`, `PORT=3001`
5) Postgres: укажите Render DB URL или Neon URL в `DATABASE_URL` (SSL уже включён).
6) После деплоя: выполнить миграции (`npm run db:migrate`) через Render Shell.

Фронтенд собран в `backend/dist/public` и отдаётся Express со SPA fallback. WebSocket адрес берите с того же хоста (`VITE_WS_URL=wss://<service>.onrender.com`).
