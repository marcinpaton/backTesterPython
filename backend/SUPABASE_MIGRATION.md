# 🚀 Migracja do Supabase - Instrukcja

## ✅ Wykonane kroki

### 1. Instalacja bibliotek
- ✅ Zainstalowano `supabase` - biblioteka klienta Supabase
- ✅ Zainstalowano `psycopg2-binary` - sterownik PostgreSQL
- ✅ Zainstalowano `python-dotenv` - zarządzanie zmiennymi środowiskowymi

### 2. Konfiguracja
- ✅ Utworzono plik `.env` z danymi połączenia do Supabase
- ✅ Utworzono plik `.env.example` jako szablon
- ✅ Utworzono moduł `app/supabase_client.py` do zarządzania połączeniem

### 3. Skrypt migracji
- ✅ Utworzono `migrate_to_supabase.py` do przeniesienia danych z CSV

---

## 📋 Następne kroki (do wykonania)

### Krok 1: Utwórz tabele w Supabase

1. Wejdź do panelu Supabase: https://ttnrazvdvezrnfmnxenl.supabase.co
2. Kliknij **SQL Editor** w menu po lewej stronie
3. Kliknij **New Query**
4. Wklej poniższy kod SQL:

```sql
-- Tabela transakcji
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY,
    date TIMESTAMP NOT NULL,
    type VARCHAR(20) NOT NULL,
    amount_pln DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'PLN',
    ticker VARCHAR(20),
    quantity DECIMAL(15, 6),
    price DECIMAL(15, 6),
    fee_pln DECIMAL(15, 2) DEFAULT 0.0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela tickerów
CREATE TABLE IF NOT EXISTS tickers (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indeksy dla lepszej wydajności
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_ticker ON transactions(ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
```

5. Kliknij **Run** (lub naciśnij `Ctrl+Enter`)
6. Sprawdź czy pojawił się komunikat "Success"

### Krok 2: Uruchom migrację danych

W terminalu wykonaj:

```bash
cd /home/mpaton/Projects/my/backTesterPython/backTesterPython/backend
python migrate_to_supabase.py
```

Skrypt:
- Przeniesie wszystkie transakcje z `transactions.csv` do Supabase
- Przeniesie wszystkie tickery z `tickers.csv` do Supabase
- Wyświetli podsumowanie migracji

### Krok 3: Sprawdź dane w Supabase

1. W panelu Supabase kliknij **Table Editor**
2. Wybierz tabelę `transactions` - powinieneś zobaczyć swoje transakcje
3. Wybierz tabelę `tickers` - powinieneś zobaczyć listę tickerów

---

## 🔄 Następna faza: Aktualizacja kodu aplikacji

Po pomyślnej migracji danych, będziemy musieli zaktualizować kod aplikacji, aby:

1. **Odczytywać dane z Supabase** zamiast z CSV
2. **Zapisywać nowe transakcje** do Supabase
3. **Zarządzać tickerami** przez Supabase

Pliki do aktualizacji:
- `app/main.py` - endpointy API
- Nowe moduły do obsługi bazy danych

---

## 📝 Notatki

### Bezpieczeństwo
- Plik `.env` jest w `.gitignore` - nie zostanie wysłany do repozytorium
- Nigdy nie udostępniaj klucza `SUPABASE_KEY` publicznie
- Plik `.env.example` służy jako szablon bez wrażliwych danych

### Zalety Supabase
- ✅ Dane dostępne z każdego komputera
- ✅ Automatyczne backupy
- ✅ Szybkie zapytania SQL
- ✅ Darmowy tier: 500 MB storage
- ✅ Dashboard do przeglądania danych

### CSV vs Supabase
- **CSV**: Plik lokalny, trzeba przenosić między komputerami
- **Supabase**: Dane w chmurze, dostęp z dowolnego miejsca

---

## ❓ Pytania?

Jeśli masz pytania lub napotkasz problemy podczas migracji, daj znać!
