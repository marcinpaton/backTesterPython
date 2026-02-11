#!/usr/bin/env python3
import re
from datetime import datetime

def analyze_scores(file_path):
    print(f"Analyzing file: {file_path}")

    # Read the file
    try:
        with open(file_path, 'r') as file:
            lines = [line.strip() for line in file if line.strip()]
        print(f"Found {len(lines)} lines in the file")
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # Initialize variables
    current_year = None
    yearly_data = {}
    first_value_of_year = {}

    # Enable detailed debugging - set to False to reduce output
    debug_mode = True

    # Special handling for the first date
    special_case_handled = False

    # Process the file
    i = 0
    while i < len(lines):
        line = lines[i]
        
        if debug_mode:
            print(f"Line {i}: '{line}'")

        # Skip comment lines
        if line.startswith('//'):
            if debug_mode:
                print(f"  → Comment line detected, skipping")
            i += 1
            continue
            
        # Check if line is a year
        year_match = re.match(r'^\d{4}$', line)
        if year_match:
            current_year = int(line)
            if debug_mode:
                print(f"  → Year marker detected: {current_year}")
            print(f"Found year: {current_year}")
            yearly_data[current_year] = {'values': [], 'returns': [], 'dates': []}
            i += 1
            continue

        # Check for date line
        date_match = re.match(r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec)(?:\.|\w*)\s+(\d+),\s+(\d{4})$', line)
        if date_match:
            month, day, year = date_match.groups()
            date = f"{month} {day}, {year}"
            year_int = int(year)

            if debug_mode:
                print(f"  → Date detected: {date}")

            # Check if next line is a portfolio value
            if i + 1 < len(lines) and '$' in lines[i + 1]:
                # Next line is portfolio value
                value_str = lines[i + 1].replace('$', '').replace(',', '')

                if debug_mode:
                    print(f"  → Portfolio value: {lines[i + 1]} → {value_str}")

                try:
                    current_value = float(value_str)

                    # Store the value for the current year
                    if year_int in yearly_data:
                        yearly_data[year_int]['values'].append(current_value)
                        yearly_data[year_int]['dates'].append(date)

                    # Special handling for the first entries
                    if not special_case_handled and date == "Jan 1, 2020":
                        if i + 3 < len(lines) and lines[i + 3] == "Feb. 1, 2020" and i + 4 < len(lines) and '$' in lines[i + 4] and i + 5 < len(lines) and '%' in lines[i + 5]:
                            # We found the Feb. 1, 2020 entry
                            feb_date = "Feb 1, 2020"
                            feb_value_str = lines[i + 4].replace('$', '').replace(',', '')
                            feb_return_str = lines[i + 5].replace('%', '')

                            if debug_mode:
                                print(f"  → Special case: Found Feb. 1, 2020 entry")
                                print(f"  → Feb value: {lines[i + 4]} → {feb_value_str}")
                                print(f"  → Feb return: {lines[i + 5]} → {feb_return_str}")

                            try:
                                feb_value = float(feb_value_str)
                                feb_return = float(feb_return_str)

                                yearly_data[2020]['values'].append(feb_value)
                                yearly_data[2020]['dates'].append(feb_date)
                                yearly_data[2020]['returns'].append(feb_return)

                                if debug_mode:
                                    print(f"  → Added Feb. 1, 2020 with value {feb_value} and return {feb_return}%")

                                special_case_handled = True
                            except ValueError:
                                if debug_mode:
                                    print(f"  → Failed to parse Feb. 1, 2020 values")

                    # Check for percentage change
                    if i + 2 < len(lines) and '%' in lines[i + 2]:
                        # Next line is percentage change
                        return_str = lines[i + 2].replace('%', '')

                        if debug_mode:
                            print(f"  → Percentage change: {lines[i + 2]} → {return_str}")

                        try:
                            return_value = float(return_str)
                            if year_int in yearly_data:
                                yearly_data[year_int]['returns'].append(return_value)
                                if debug_mode:
                                    print(f"  → Added return {return_value}% for {year_int}")
                        except ValueError:
                            if debug_mode:
                                print(f"  → Failed to parse return value: {lines[i + 2]}")

                        # Move past this triplet (date, value, percentage)
                        i += 3
                    else:
                        # No percentage found, move past date and value
                        i += 2
                        if debug_mode:
                            print(f"  → No percentage change found after value")
                except ValueError:
                    if debug_mode:
                        print(f"  → Failed to parse portfolio value: {lines[i + 1]}")
                    i += 2  # Skip the date and invalid value
            else:
                if debug_mode:
                    print(f"  → No portfolio value found after date")
                i += 1
        elif '$' in line and i > 0 and i + 1 < len(lines) and '%' in lines[i + 1]:
            # This is a standalone portfolio value line (like line 4: '$104196')
            # Check if previous line was a date
            prev_line = lines[i - 1]
            date_match = re.match(r'^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept|Oct|Nov|Dec)(?:\.|\w*)\s+(\d+),\s+(\d{4})$', prev_line)

            if date_match:
                month, day, year = date_match.groups()
                date = f"{month} {day}, {year}"
                year_int = int(year)

                # Process value
                value_str = line.replace('$', '').replace(',', '')
                if debug_mode:
                    print(f"  → Portfolio value (standalone): {line} → {value_str}")

                try:
                    current_value = float(value_str)

                    # Store the value
                    if year_int in yearly_data:
                        yearly_data[year_int]['values'].append(current_value)
                        yearly_data[year_int]['dates'].append(date)

                    # Process percentage
                    return_str = lines[i + 1].replace('%', '')
                    if debug_mode:
                        print(f"  → Percentage change: {lines[i + 1]} → {return_str}")

                    try:
                        return_value = float(return_str)
                        if year_int in yearly_data:
                            yearly_data[year_int]['returns'].append(return_value)
                            if debug_mode:
                                print(f"  → Added return {return_value}% for {year_int}")
                    except ValueError:
                        if debug_mode:
                            print(f"  → Failed to parse return value: {lines[i + 1]}")

                    # Move past value and percentage
                    i += 2

                except ValueError:
                    if debug_mode:
                        print(f"  → Failed to parse portfolio value: {line}")
                    i += 1
            else:
                if debug_mode:
                    print(f"  → Unrecognized line type, skipping")
                i += 1
        else:
            if debug_mode:
                print(f"  → Unrecognized line type, skipping")
            i += 1

    # Print debug info
    print("\nDebug information:")
    for year, data in yearly_data.items():
        print(f"Year: {year}")
        print(f"  Values: {data['values']}")
        print(f"  Returns: {data['returns']}")
        print(f"  Dates: {data['dates']}")
        print(f"  Number of entries: {len(data['values'])}")

    # Calculate metrics
    results = {}
    all_values = []
    all_dates = []
    
    for year, data in yearly_data.items():
        values = data['values']
        returns = data['returns']
        dates = data['dates']
        
        if not values or len(values) < 2:
            print(f"Skipping year {year} - insufficient data")
            continue
            
        # Add to all values for overall calculations
        all_values.extend(values)
        all_dates.extend(dates)
            
        # Calculate yearly metrics
        start_value = values[0]
        end_value = values[-1]
        yearly_return = ((end_value / start_value) - 1) * 100
        
        # Calculate maximum drawdown for the year
        max_drawdown = 0
        peak = values[0]
        peak_date = dates[0]
        max_dd_date = dates[0]

        for i, value in enumerate(values):
            if value > peak:
                peak = value
                peak_date = dates[i]
            drawdown = ((peak - value) / peak) * 100
            if drawdown > max_drawdown:
                max_drawdown = drawdown
                max_dd_date = dates[i]

        results[year] = {
            'yearly_return': yearly_return,
            'max_drawdown': max_drawdown,
            'peak_date': peak_date,
            'max_dd_date': max_dd_date
        }
    
    # Calculate overall maximum drawdown
    overall_max_drawdown = 0
    overall_peak_date = ""
    overall_max_dd_date = ""

    if all_values:
        peak = all_values[0]
        peak_idx = 0

        for i, value in enumerate(all_values):
            if value > peak:
                peak = value
                peak_idx = i
            drawdown = ((peak - value) / peak) * 100
            if drawdown > overall_max_drawdown:
                overall_max_drawdown = drawdown
                overall_peak_date = all_dates[peak_idx]
                overall_max_dd_date = all_dates[i]

    # Print results
    print("\n===== PORTFOLIO ANALYSIS =====\n")

    for year, metrics in sorted(results.items()):
        print(f"YEAR {year}:")
        print(f"  Yearly Profit/Loss: {metrics['yearly_return']:.2f}%")
        print(f"  Maximum Drawdown: {metrics['max_drawdown']:.2f}%")
        print(f"  Peak Date: {metrics['peak_date']}")
        print(f"  Max Drawdown Date: {metrics['max_dd_date']}")
        print()
    
    print("OVERALL METRICS:")
    print(f"  Maximum Drawdown Across All Years: {overall_max_drawdown:.2f}%")
    if overall_peak_date and overall_max_dd_date:
        print(f"  Peak Date: {overall_peak_date}")
        print(f"  Max Drawdown Date: {overall_max_dd_date}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
    else:
        file_path = "scores.txt"
    
    analyze_scores(file_path)
