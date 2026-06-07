#!/usr/bin/env python3
import os
import sys

PLACEHOLDERS = [
    '<repo>',
    '<vercel-url>',
    '<link>',
    '<video-url>',
    '{{variables}}'
]

def check_file(filepath):
    errors = 0
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for line_no, line in enumerate(lines, 1):
                for placeholder in PLACEHOLDERS:
                    if placeholder in line:
                        print(f"❌ Placeholder '{placeholder}' found in {filepath}:{line_no}")
                        print(f"   Line: {line.strip()}")
                        errors += 1
    except Exception as e:
        print(f"⚠️ Error reading {filepath}: {e}")
    return errors

def main():
    print("🔎 Scanning workspace for placeholder tokens...")
    total_errors = 0
    
    # Files to check specifically or directories to scan
    exclude_dirs = {'.git', '.next', 'node_modules', 'public'}
    
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith('.md'):
                filepath = os.path.join(root, file)
                total_errors += check_file(filepath)

    if total_errors > 0:
        print(f"\n🛑 Verification FAILED: {total_errors} placeholders found. Please update them before submitting.")
        sys.exit(1)
    else:
        print("\n🌟 Verification PASSED: No placeholders found! Ready for submission.")
        sys.exit(0)

if __name__ == "__main__":
    main()
