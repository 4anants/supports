#!/bin/sh
echo "=== Installing dependencies ==="
npm install

echo "=== Generating Prisma Client ==="
npx prisma generate

echo "=== Running TypeScript Compiler with full output ==="
npx tsc --pretty --listFiles 2>&1 | tee build-error.log

echo "=== Build Exit Code: $? ==="
