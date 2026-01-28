# Rozwiązanie konfliktu websockets

## Problem
Backend nie mógł się uruchomić z powodu konfliktu wersji `websockets`:
- `yfinance 0.2.59` wymaga `websockets >= 13.0`
- `supabase` (realtime) wymaga `websockets < 13.0`

## Rozwiązanie
Zainstalowano `yfinance 0.2.58`, która jest kompatybilna z `websockets 12.0`.

## Zmiany
- Zaktualizowano `requirements.txt`: `yfinance<0.2.59`
- Zainstalowano kompatybilne wersje w venv

## Testy
✅ Backend importuje się poprawnie  
✅ Połączenie z Supabase działa  
✅ Dane są dostępne (7 transakcji, 128 tickerów)

## Uruchomienie
```bash
cd /home/mpaton/Projects/my/backTesterPython/backTesterPython
./manage_services.sh restart
```

Backend powinien teraz działać poprawnie! 🎉
