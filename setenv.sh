#!/bin/bash

# Ensure the .env file exists
if [ ! -f ".env" ]; then
    echo ".env file does not exist."
    exit 1
fi

# Export the variables
while read -r line || [[ -n "$line" ]]; do
  # Strip line of leading and trailing whitespace
  line=$(echo "$line" | sed 's/^[ \t]*//;s/[ \t]*$//')
  
  # Skip empty lines and lines starting with '#' (comments)
  if [[ -z "$line" ]] || [[ "$line" =~ ^# ]]; then
    continue
  fi
  
  # Parse the key and value
  key=$(echo "$line" | cut -d '=' -f 1)
  value=$(echo "$line" | cut -d '=' -f 2-)

  # Debugging message
  echo "Setting: $key to '$value'"
  
  # Properly handle values with spaces or special characters
  eval export "$key='$value'"
done < ".env"

echo "Environment variables set."

# Start nodemon
nodemon -L # -L required for wsl2

