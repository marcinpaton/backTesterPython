import re
from datetime import datetime
from typing import List, Tuple, Optional

def parse_ticker_group_file(content: str) -> Tuple[Optional[str], List[str]]:
    """
    Parses a ticker group file content.
    Returns a tuple of (valid_from_date, list_of_tickers).
    """
    # 1. Extract date
    # Format: "Scores on 1st October, 2006"
    date_match = re.search(r"Scores on (\d+)(?:st|nd|rd|th)? (\w+), (\d{4})", content)
    if not date_match:
        # Fallback for simpler format if any
        date_match = re.search(r"Scores on (\d\d? \w+ \d{4})", content)
    
    valid_from = None
    if date_match:
        try:
            day = date_match.group(1)
            month_name = date_match.group(2)
            year = date_match.group(3)
            
            # Map month names if needed, but strptime %B handles full names
            date_str = f"{day} {month_name} {year}"
            dt = datetime.strptime(date_str, "%d %B %Y")
            valid_from = dt.strftime("%Y-%m-%d")
        except Exception as e:
            print(f"Error parsing date: {e}")

    # 2. Extract tickers
    # Tickers start after "current price" or similar header
    # Lines look like: "EXL1V.HE\t100.0%\t100%" or "EXL1V.HE 100.0% 100%"
    # We look for lines that have a ticker-like string followed by a percentage
    
    tickers = []
    lines = content.split('\n')
    
    # Simple regex for ticker: Uppercase followed by optional dots/numbers and exchange suffix
    # e.g. AAPL, BB.TO, EXL1V.HE, 0682.HK
    ticker_pattern = re.compile(r"^([A-Z0-9\.]+)\s+[\d\.]+%")
    
    for line in lines:
        line = line.strip()
        match = ticker_pattern.match(line)
        if match:
            tickers.append(match.group(1))
        elif re.match(r"^[A-Z0-9\.]+$", line) and not any(h in line for h in ["Search", "Ctrl", "Company", "Total", "current price"]):
            # Exclude single digit numbers (likely page numbers)
            if not (len(line) == 1 and line.isdigit()):
                tickers.append(line)
             
    # Clean up tickers
    tickers = [t.strip().upper() for t in tickers if t.strip()]
    # Remove duplicates while preserving order
    seen = set()
    cleaned_tickers = []
    
    # Common words or patterns to exclude
    exclude_list = ["SEARCH", "CTRL", "COMPANY", "TOTAL", "CURRENT PRICE", "ROWS", "GOLD", "‹", "›", "‹", "›"]
    
    for t in tickers:
        if t not in seen and t not in exclude_list and not (len(t) == 1 and t.isdigit()):
             cleaned_tickers.append(t)
             seen.add(t)

    return valid_from, cleaned_tickers
