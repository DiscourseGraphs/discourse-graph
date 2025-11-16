#!/bin/bash
# Simple test script for tldraw-agent endpoint
# Make sure your dev server is running on localhost:3000

API_URL="${API_URL:-http://localhost:3000/api/tldraw-agent/stream}"

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": {
      "type": "messages",
      "messages": ["Create a new node with text \"HEllo world\""]
    },
    "modelName": {
      "type": "modelName",
      "modelName": "gpt-4o"
    },
    "systemPrompt": {
      "type": "systemPrompt",
      "systemPrompt": ""
    },
    "chatHistory": {
      "type": "chatHistory",
      "items": []
    }
  }' \
  --no-buffer
