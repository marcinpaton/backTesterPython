# Analiza Logów Backtestu (SMA vs Rentowność)

Na podstawie analizy plików `logs1.txt` (2020+), `logs2.txt` (2007+) oraz `logs3.txt` (2015-2019) przeprowadzono kompleksowe badanie rentowności strategii w różnych reżimach rynkowych.

## Porównanie Zależności w Różnych Okresach

| Plik (Okres) | Win Rate (Poniżej SMA) | Avg Return (Powyżej SMA) | Avg Return (Poniżej SMA) | Główny Wniosek |
| :--- | :--- | :--- | :--- | :--- |
| **logs1.txt (2020+)** | **61.3%** | **+15.39%** | +8.82% | Silna hossa – oba reżimy zyskowne. |
| **logs2.txt (2007+)** | 49.2% | +3.58% | **-3.89%** | Kryzys 2008 – "poniżej SMA" = duże straty. |
| **logs3.txt (2015-19)** | 50.0% | -0.07% | **+4.30%** | Rynek płaski/choppy – kupowanie dipów pod SMA lepsze niż momentum. |

## Szczegółowe Statystyki: logs3.txt (2015-2019)

| Metryka | Grupa 1 (Powyżej SMA200) | Grupa 2 (Poniżej SMA200) |
| :--- | :--- | :--- |
| **Liczba pozycji** | 118 | 24 |
| **Skuteczność (Win Rate)** | 46.6% | **50.0%** |
| **Średni zwrot (Avg Return)** | -0.07% | **+4.30%** |
| **Śr. dystans SMA (Zyski)** | 4.32% | -4.38% |
| **Śr. dystans SMA (Straty)** | 4.68% | -3.20% |

## Kluczowe Wnioski z Całej Analizy (Mega-Summary)

### 1. Zmienność Roli Średniej SMA200
- **W hossie (logs1)**: Bycie pod średnią to okazja do dokupienia (BTFD).
- **W bessie (logs2)**: Bycie pod średnią to ostrzeżenie przed "spadającymi nożami".
- **W konsolidacji (logs3)**: Bycie pod średnią to jedyny sposób na zysk, gdy momentum nad SMA wygasa.

### 2. Krytyczny Punkt Przegrzania (8-9%)
Analiza wszystkich trzech plików potwierdza: otwieranie pozycji, gdy SP500 jest powyżej **8.5% ponad swoją średnią SMA200**, drastycznie zwiększa ryzyko straty. Jest to spójne w każdym badanym okresie.

### 3. Asymetria Zysków i Strat
- Największe jednostkowe zyski (logs1) pojawiają się, gdy rynek "ucieka" w górę, ale wymaga to zdrowego fundamentu (hossy).
- Największe jednostkowe straty (logs2) pojawiają się, gdy ignorujemy fakt, że rynek jest trwale poniżej SMA200 (reżim bear market).

## Ostateczna Rekomendacja Operacyjna
1. **Unikaj agresywnych wejść**, gdy SP500 > 8% nad SMA200 (ryzyko korekty jest zbyt wysokie).
2. **Wyłączaj sygnały**, gdy rynek jest poniżej SMA200, **CHYBA ŻE** jesteś w reżimie "choppy market" (co można rozpoznać po niskiej zmienności lub braku wyraźnego trendu na SP500). W czasie paniki (2008) filtr jest bezwzględnie konieczny.
