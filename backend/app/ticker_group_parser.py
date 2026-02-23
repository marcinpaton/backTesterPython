import re
from datetime import datetime
from typing import List, Tuple, Optional

def parse_ticker_group_file(content: str) -> Tuple[Optional[str], List[str]]:
    """
    Parses a ticker group file content using simplified logic:
    1. Extract date from "Scores on" line.
    2. Tickers are located after the last "current price" header.
    """
    # 1. Extract date
    # Format: "Scores on 1st October, 2006"
    date_match = re.search(r"Scores on (\d+)(?:st|nd|rd|th)? (\w+), (\d{4})", content)
    if not date_match:
        date_match = re.search(r"Scores on (\d\d? \w+ \d{4})", content)
    
    valid_from = None
    if date_match:
        try:
            day = date_match.group(1)
            month_name = date_match.group(2)
            year = date_match.group(3)
            date_str = f"{day} {month_name} {year}"
            dt = datetime.strptime(date_str, "%d %B %Y")
            valid_from = dt.strftime("%Y-%m-%d")
        except Exception as e:
            print(f"Error parsing date: {e}")

    # 2. Extract tickers
    lines = content.split('\n')
    
    # Find the index of the LAST occurrence of "current price"
    start_index = -1
    for i, line in enumerate(lines):
        if "current price" in line.lower():
            start_index = i

    tickers = []
    if start_index != -1:
        # Tickers are in the lines starting AFTER the header
        for line in lines[start_index + 1:]:
            line = line.strip()
            if not line:
                continue
            
            # Usually the line starts with the ticker, or it is the ticker
            # Format: "AAPL 1.2% 1.0%" or just "AAPL"
            parts = line.split()
            if not parts:
                continue
                
            ticker_candidate = parts[0].strip().upper()
            
            # Filter out known non-ticker UI noise or marks
            # '–' is a placeholder for missing values, not a ticker
            if ticker_candidate in ["–", "‹", "›", "SEARCH", "CTRL"]:
                continue
            
            # Simple ticker validation: must contain at least one uppercase letter or digit
            if not re.match(r"^[A-Z0-9\.\-]+$", ticker_candidate):
                continue
                
            # Exclude single digit numbers and pagination counts (25, 50, etc.)
            if ticker_candidate.isdigit():
                if len(ticker_candidate) == 1 or int(ticker_candidate) in [25, 50, 100, 200, 500]:
                    continue
            
            tickers.append(ticker_candidate)

    # Remove duplicates while preserving order
    seen = set()
    cleaned_tickers = []
    for t in tickers:
        if t not in seen:
            cleaned_tickers.append(t)
            seen.add(t)

    return valid_from, cleaned_tickers
