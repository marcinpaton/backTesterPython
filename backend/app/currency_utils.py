def infer_currency(ticker: str) -> str:
    """Infers currency from Yahoo Finance ticker suffix"""
    if ticker.endswith('.L'): return 'GBP'
    if ticker.endswith('.TO'): return 'CAD'
    if ticker.endswith('.WA'): return 'PLN'
    if ticker.endswith('.DE') or ticker.endswith('.AS') or ticker.endswith('.PA') or ticker.endswith('.BR') or ticker.endswith('.MI'): return 'EUR'
    if ticker.endswith('.ST'): return 'SEK'
    if ticker.endswith('.CO'): return 'DKK'
    if ticker.endswith('.BK'): return 'THB'
    if ticker.endswith('.HK'): return 'HKD'
    if ticker.endswith('.AX'): return 'AUD'
    # Default to USD for US exchanges (no suffix)
    return 'USD'
