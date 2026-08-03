#!/bin/bash

# Build script for SimplyChat Electron App

echo "Building SimplyChat Application..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf dist

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the application
echo "Building application..."
npm run build

echo "Build completed! Check the dist folder for the packaged application."