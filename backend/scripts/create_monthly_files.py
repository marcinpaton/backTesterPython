import os
import sys

def create_monthly_files(year):
    target_dir = "/home/mpaton/Projects/my/backTesterPython/backTesterPython/backend/data/companies/USA_UK"
    
    if not os.path.exists(target_dir):
        print(f"Error: Directory {target_dir} does not exist.")
        return

    print(f"Creating files for year {year} in {target_dir}...")
    
    for month in range(1, 13):
        # Format month as NN (01, 02, ..., 12)
        month_str = f"{month:02d}"
        filename = f"{year}_{month_str}"
        file_path = os.path.join(target_dir, filename)
        
        if os.path.exists(file_path):
            print(f"Skipping {filename}: File already exists.")
        else:
            try:
                with open(file_path, 'w') as f:
                    pass  # Create an empty file
                print(f"Created {filename}.")
            except Exception as e:
                print(f"Error creating {filename}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_monthly_files.py <YYYY>")
        sys.exit(1)
    
    year_to_process = sys.argv[1]
    create_monthly_files(year_to_process)
