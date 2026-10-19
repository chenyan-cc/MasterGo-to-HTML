#!/usr/bin/env python3
"""Compare an explicit delivery file list without copying or deleting files."""
import argparse
import hashlib
import json
from pathlib import Path


def digest(root, name):
    relative = Path(name)
    if relative.is_absolute() or '..' in relative.parts or not relative.parts:
        raise ValueError(f'Unsafe relative path: {name}')
    target = (root / relative).resolve()
    if not target.is_relative_to(root):
        raise ValueError(f'Path escapes root: {name}')
    if not target.is_file():
        return None
    return hashlib.sha256(target.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('file_list', type=Path, help='JSON array of delivery-relative paths')
    args = parser.parse_args()
    names = json.loads(args.file_list.read_text())
    if not isinstance(names, list) or not names or not all(isinstance(n, str) for n in names):
        parser.error('file_list must be a nonempty JSON string array')
    source, destination = args.source.resolve(), args.destination.resolve()
    checks = []
    for name in names:
        left, right = digest(source, name), digest(destination, name)
        checks.append({'file': name, 'sourceSha256': left, 'destinationSha256': right,
                       'equal': left is not None and left == right})
    matched = all(c['equal'] for c in checks)
    print(json.dumps({'deliveryStatus': 'verified' if matched else 'mismatch', 'files': checks}, ensure_ascii=False, indent=2))
    return 0 if matched else 1


if __name__ == '__main__':
    raise SystemExit(main())
