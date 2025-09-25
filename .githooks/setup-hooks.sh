#!/bin/sh
# Setup Git hooks for UIT-Go project
# Run this script to install the Git hooks

echo "🔧 Setting up Git hooks for UIT-Go project..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in a Git repository
if [ ! -d ".git" ]; then
    echo "${RED}❌ Not in a Git repository${NC}"
    exit 1
fi

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Copy hooks and make them executable
if [ -f ".githooks/pre-commit" ]; then
    cp .githooks/pre-commit .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "${GREEN}✅ Pre-commit hook installed${NC}"
else
    echo "${RED}❌ Pre-commit hook file not found${NC}"
fi

if [ -f ".githooks/pre-push" ]; then
    cp .githooks/pre-push .git/hooks/pre-push
    chmod +x .git/hooks/pre-push
    echo "${GREEN}✅ Pre-push hook installed${NC}"
else
    echo "${RED}❌ Pre-push hook file not found${NC}"
fi

# Check if Node.js and npm are available
if ! command -v node > /dev/null 2>&1; then
    echo "${YELLOW}⚠️ Node.js not found. Some hooks may not work properly${NC}"
fi

if ! command -v npm > /dev/null 2>&1; then
    echo "${YELLOW}⚠️ npm not found. Some hooks may not work properly${NC}"
fi

# Check if Docker is available
if ! command -v docker > /dev/null 2>&1; then
    echo "${YELLOW}⚠️ Docker not found. Docker-related checks will be skipped${NC}"
fi

if ! command -v docker-compose > /dev/null 2>&1; then
    echo "${YELLOW}⚠️ Docker Compose not found. Docker Compose validation will be skipped${NC}"
fi

echo ""
echo "${GREEN}🎉 Git hooks setup complete!${NC}"
echo ""
echo "📋 Installed hooks:"
echo "  • pre-commit: Runs code quality checks before each commit"
echo "  • pre-push: Runs comprehensive checks before pushing to remote"
echo ""
echo "💡 To bypass hooks temporarily, use:"
echo "  git commit --no-verify"
echo "  git push --no-verify"
echo ""
echo "🔧 To update hooks, run this script again"