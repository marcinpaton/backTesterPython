#!/usr/bin/env python3
"""
Converter for old optimization results files to new format with JSON footer.
This allows old files to be loaded with the Load Results button.

Usage:
    python convert_old_results.py <input_file> [output_file]
    
If output_file is not specified, it will overwrite the input file.
"""

import sys
import json
import re
from pathlib import Path


def parse_walk_forward_file(content):
    """Parse old walk-forward results file and extract data into JSON structure"""
    
    lines = content.split('\n')
    
    # Extract metadata
    total_windows = None
    train_period_months = None
    test_period_months = None
    step_months = None
    
    for line in lines[:20]:  # Check first 20 lines for metadata
        if 'Total Windows:' in line:
            total_windows = int(re.search(r'(\d+)', line).group(1))
        elif 'Train Period:' in line:
            # Extract months from "Train Period: 7.0 years (84 months)"
            match = re.search(r'\((\d+) months\)', line)
            if match:
                train_period_months = int(match.group(1))
        elif 'Test Period:' in line:
            match = re.search(r'(\d+) months', line)
            if match:
                test_period_months = int(match.group(1))
        elif 'Step:' in line:
            match = re.search(r'(\d+) months', line)
            if match:
                step_months = int(match.group(1))
    
    # Parse individual windows
    windows = []
    current_window = None
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Detect window start
        if line.startswith('Window ') and ':' in line:
            # Extract window number and dates
            # Format: "Window 1: 2011-01-01 → 2013-12-31"
            match = re.match(r'Window (\d+): ([\d-]+) → ([\d-]+)', line)
            if match:
                window_num = int(match.group(1))
                
                # Read next lines for train/test dates
                i += 1
                train_line = lines[i].strip() if i < len(lines) else ""
                i += 1
                test_line = lines[i].strip() if i < len(lines) else ""
                
                # Extract dates
                # Format: "Train: 2011-01-01 to 2012-12-31"
                train_match = re.search(r'Train: ([\d-]+) to ([\d-]+)', train_line)
                test_match = re.search(r'Test: ([\d-]+) to ([\d-]+)', test_line)
                
                if train_match and test_match:
                    current_window = {
                        'window_number': window_num,
                        'window': {
                            'train_start': train_match.group(1),
                            'train_end': train_match.group(2),
                            'test_start': test_match.group(1),
                            'test_end': test_match.group(2)
                        },
                        'train_results': [],
                        'test_results': [],
                        'scores': []
                    }
        
        # Parse result lines
        # Format: "1. bossa | N:5 | Rebal:1 | Look:20 | Train CAGR:27.31% DD:-13.25% | Test CAGR:-14.52% DD:-25.84% | Score:40.0"
        elif current_window and re.match(r'^\d+\.', line):
            match = re.match(
                r'(\d+)\. (\w+) \| N:(\d+) \| Rebal:(\d+) \| Look:([\d-]+) \| '
                r'Train CAGR:([-\d.]+)% DD:([-\d.]+)% \| '
                r'Test CAGR:([-\d.]+)% DD:([-\d.]+)% \| '
                r'Score:([\d.]+)',
                line
            )
            
            if match:
                rank = int(match.group(1))
                broker = match.group(2)
                n_tickers = int(match.group(3))
                rebalance = int(match.group(4))
                lookback = match.group(5)
                train_cagr = float(match.group(6)) / 100
                train_dd = float(match.group(7)) / 100
                test_cagr = float(match.group(8)) / 100
                test_dd = float(match.group(9)) / 100
                score = float(match.group(10))
                
                # Convert lookback to int if not '-'
                lookback_days = int(lookback) if lookback != '-' else None
                
                # Create train result
                train_result = {
                    'broker': broker,
                    'n_tickers': n_tickers,
                    'rebalance_period': rebalance,
                    'cagr': train_cagr,
                    'max_drawdown': train_dd
                }
                if lookback_days is not None:
                    train_result['momentum_lookback_days'] = lookback_days
                
                # Create test result
                test_result = {
                    'broker': broker,
                    'n_tickers': n_tickers,
                    'rebalance_period': rebalance,
                    'cagr': test_cagr,
                    'max_drawdown': test_dd
                }
                if lookback_days is not None:
                    test_result['momentum_lookback_days'] = lookback_days
                
                current_window['train_results'].append(train_result)
                current_window['test_results'].append(test_result)
                current_window['scores'].append(score)
        
        # Detect end of window (empty line after results)
        elif current_window and line == '' and current_window['train_results']:
            windows.append(current_window)
            current_window = None
        
        i += 1
    
    # Add last window if exists
    if current_window and current_window['train_results']:
        windows.append(current_window)
    
    # Build JSON structure
    result = {
        'walk_forward_mode': True,
        'total_windows': total_windows or len(windows),
        'train_period_months': train_period_months,
        'test_period_months': test_period_months,
        'step_months': step_months,
        'windows': windows
    }
    
    return result


def convert_file(input_path, output_path=None):
    """Convert old results file to new format with JSON footer"""
    
    input_path = Path(input_path)
    if not input_path.exists():
        print(f"Error: File not found: {input_path}")
        return False
    
    # Read original file
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if already has JSON footer
    if '# JSON DATA (for re-loading results)' in content:
        print(f"File already has JSON footer: {input_path}")
        return True
    
    # Parse the file
    try:
        json_data = parse_walk_forward_file(content)
    except Exception as e:
        print(f"Error parsing file: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Create new content with JSON footer
    new_content = content.rstrip() + "\n\n"
    new_content += "=" * 80 + "\n"
    new_content += "# JSON DATA (for re-loading results)\n"
    new_content += "=" * 80 + "\n"
    new_content += json.dumps(json_data, indent=2)
    new_content += "\n"
    
    # Write to output file
    output_path = output_path or input_path
    output_path = Path(output_path)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"✓ Converted: {input_path}")
    if output_path != input_path:
        print(f"  Output: {output_path}")
    
    return True


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    success = convert_file(input_file, output_file)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
