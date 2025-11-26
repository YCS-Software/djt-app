@echo off
echo ========================================
echo Creating Database Tables
echo ========================================
echo.
echo Host: 13.202.34.243:3306
echo Database: DJTDB
echo User: root
echo.

cd /d "%~dp0"

mysql -h 13.202.34.243 -u root -pYcsPass@2025 DJTDB < server\database\schema.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo SUCCESS! All tables created
    echo ========================================
    echo.
    echo You can now start your server:
    echo   cd server
    echo   npm start
    echo.
) else (
    echo.
    echo ========================================
    echo ERROR! Failed to create tables
    echo ========================================
    echo.
    echo Please check:
    echo 1. MySQL client is installed
    echo 2. Database DJTDB exists
    echo 3. Network connection to 13.202.34.243
    echo.
)

pause
