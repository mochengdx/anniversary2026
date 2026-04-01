#!/bin/bash
set -e

echo "📦 Building h5-client..."
cd apps/h5-client && pnpm run build
cd ../..

echo "📦 Building screen-web..."
cd apps/screen-web && pnpm run build
cd ../..

echo "📦 Setting up server public directory..."
rm -rf apps/server/public
mkdir -p apps/server/public/h5
mkdir -p apps/server/public/screen

echo "🚚 Copying static files..."
cp -R apps/h5-client/dist/* apps/server/public/h5/
cp -R apps/screen-web/dist/* apps/server/public/screen/

echo "🔨 Building server..."
cd apps/server && pnpm run build
cd ../..

echo "✅ All done! You can now start the server with: cd apps/server && pnpm start"
echo "🌐 Access H5 at: http://<your-ip>:3000/h5"
echo "📺 Access Screen at: http://<your-ip>:3000/screen"
