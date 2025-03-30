#!/bin/bash

# Script to help release a new version of the VS Code extension

# Check if a version is provided
if [ -z "$1" ]; then
  echo "Usage: ./release.sh <version>"
  echo "Example: ./release.sh 0.1.0"
  exit 1
fi

VERSION=$1

# Update the version in package.json
sed -i.bak "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$VERSION\"/" package.json
rm package.json.bak

echo "Building and packaging extension..."
npm run package:dist

# Verify the .vsix file was created
if [ -f "dist/goose-vscode-$VERSION.vsix" ]; then
  echo "✅ Extension packaged successfully: dist/goose-vscode-$VERSION.vsix"
else
  echo "❌ Packaging failed. Let's try with verbose output:"
  echo "Running with verbose flag..."
  mkdir -p dist
  npx @vscode/vsce package --no-dependencies --no-yarn -o dist/goose-vscode-$VERSION.vsix --verbose
  
  if [ -f "dist/goose-vscode-$VERSION.vsix" ]; then
    echo "✅ Extension packaged successfully on second attempt: dist/goose-vscode-$VERSION.vsix"
  else
    echo "❌ Failed to create the .vsix file. See errors above."
    exit 1
  fi
fi

echo ""
echo "To release this version, you can:"
echo "1. Commit the changes: git commit -am \"Bump vscode extension to v$VERSION\""
echo "2. Tag the release: git tag vscode-v$VERSION"
echo "3. Push the changes: git push && git push --tags"
echo ""
echo "This will trigger the GitHub workflow to create a release with the packaged extension." 
