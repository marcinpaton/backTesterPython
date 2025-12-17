#!/usr/bin/env python3
"""
Batch converter for all old optimization results files in a directory.

Usage:
    python convert_all_old_results.py [directory]
    
If directory is not specified, uses ../optimization_results/
"""

import sys
from pathlib import Path
from convert_old_results import convert_file


def convert_all_in_directory(directory):
    """Convert all .txt files in directory that don't have JSON footer"""
    
    directory = Path(directory)
    if not directory.exists():
        print(f"Error: Directory not found: {directory}")
        return False
    
    # Find all .txt files
    txt_files = list(directory.glob('*.txt'))
    
    if not txt_files:
        print(f"No .txt files found in {directory}")
        return True
    
    print(f"Found {len(txt_files)} files in {directory}")
    print("=" * 60)
    
    converted = 0
    skipped = 0
    failed = 0
    
    for txt_file in sorted(txt_files):
        # Read file to check if it needs conversion
        try:
            with open(txt_file, 'r', encoding='utf-8') as f:
                content = f.read()
            
            if '# JSON DATA (for re-loading results)' in content:
                print(f"⊘ Skipped (already converted): {txt_file.name}")
                skipped += 1
                continue
            
            # Try to convert
            if convert_file(txt_file, txt_file):
                converted += 1
            else:
                failed += 1
                
        except Exception as e:
            print(f"✗ Error processing {txt_file.name}: {e}")
            failed += 1
    
    print("=" * 60)
    print(f"Summary:")
    print(f"  Converted: {converted}")
    print(f"  Skipped: {skipped}")
    print(f"  Failed: {failed}")
    print(f"  Total: {len(txt_files)}")
    
    return failed == 0


def main():
    # Default to optimization_results directory
    if len(sys.argv) > 1:
        directory = sys.argv[1]
    else:
        # Assume script is in backend/ and results are in ../optimization_results/
        script_dir = Path(__file__).parent
        directory = script_dir.parent / 'optimization_results'
    
    print(f"Converting files in: {directory}")
    print()
    
    success = convert_all_in_directory(directory)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
