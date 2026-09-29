@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download the LTS version from https://nodejs.org and run this again. & pause & exit /b)
if not exist .env (copy .env.example .env >nul & echo Created .env - fill in your Supabase URL, anon key, service_role key and Gemini key, save, then run this again. & notepad .env & pause & exit /b)
if not exist node_modules (echo Installing packages, please wait... & call npm install)
npm start
pause
