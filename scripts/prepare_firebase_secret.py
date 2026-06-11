#!/usr/bin/env python3
"""
Helper script to prepare Firebase service account JSON for GitHub secrets.

Usage:
  python scripts/prepare_firebase_secret.py service-account.json > secret.txt

Then copy the output from secret.txt and add it as FIREBASE_SERVICE_ACCOUNT_JSON
in GitHub repository secrets.
"""

import json
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python prepare_firebase_secret.py <service-account.json>", file=sys.stderr)
        sys.exit(1)
    
    with open(sys.argv[1], 'r') as f:
        sa = json.load(f)
    
    # Output as single-line JSON
    print(json.dumps(sa))

if __name__ == "__main__":
    main()