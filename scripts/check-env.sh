#!/bin/bash
# Environment Configuration Check
# Ensures required environment variables are configured before running dev server or committing

set -euo pipefail

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ENV_FILE=".env.local"
ENV_EXAMPLE=".env.example"

# Required environment variables (without values, just keys)
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)

check_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}✗ Missing $ENV_FILE${NC}"
    echo -e "${YELLOW}→ Creating $ENV_FILE from $ENV_EXAMPLE...${NC}"

    if [ -f "$ENV_EXAMPLE" ]; then
      cp "$ENV_EXAMPLE" "$ENV_FILE"
      echo -e "${GREEN}✓ Created $ENV_FILE${NC}"
      echo -e "${YELLOW}⚠ Please edit $ENV_FILE with your actual credentials:${NC}"
      echo -e "  - Supabase project URL"
      echo -e "  - Supabase anon key"
      echo -e "  - Supabase service role key"
      echo ""
      read -p "Press Enter to open $ENV_FILE in your editor..."
      ${EDITOR:-code} "$ENV_FILE" 2>/dev/null || open "$ENV_FILE" 2>/dev/null || true
      return 1
    else
      echo -e "${RED}✗ $ENV_EXAMPLE not found${NC}"
      return 1
    fi
  fi
  return 0
}

check_required_vars() {
  if [ ! -f "$ENV_FILE" ]; then
    return 1
  fi

  local missing=0
  local configured=0

  for var in "${REQUIRED_VARS[@]}"; do
    # Check if variable exists and is not set to placeholder value
    if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
      # Remove both single and double quotes, then remove spaces
      value=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2- | sed "s/[\"']//g" | tr -d ' ')
      # Check if value is empty or a placeholder
      if [ -z "$value" ] || [[ "$value" =~ ^(your_|placeholder_|example_|YOUR_) ]]; then
        echo -e "${YELLOW}⚠ $var is not configured${NC}"
        missing=$((missing + 1))
      else
        configured=$((configured + 1))
      fi
    else
      echo -e "${YELLOW}⚠ $var is missing${NC}"
      missing=$((missing + 1))
    fi
  done

  if [ $missing -gt 0 ]; then
    echo -e "${RED}✗ $missing required variable(s) not properly configured${NC}"
    echo -e "${GREEN}✓ $configured variable(s) configured${NC}"
    return 1
  fi

  echo -e "${GREEN}✓ All required environment variables are configured${NC}"
  return 0
}

# Main check
main() {
  local needs_setup=0

  check_env_file || needs_setup=1
  check_required_vars || needs_setup=1

  if [ $needs_setup -eq 1 ]; then
    echo ""
    echo -e "${YELLOW}After configuring, restart the dev server:${NC}"
    echo "  npm run dev"
    exit 1
  fi

  return 0
}

# Run main if script is executed directly
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
