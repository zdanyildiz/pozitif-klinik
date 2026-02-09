#!/bin/bash

# Configuration
DB_NAME="test_klinik"
DB_USER="root"
DB_HOST="127.0.0.1"
MYSQLDUMP_PATH="/opt/lampp/bin/mysqldump"
DATE=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="storage/backups"
FILENAME="${OUTPUT_DIR}/${DB_NAME}_${DATE}.sql"

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "--------------------------------------------------"
echo "Database Export: $DB_NAME"
echo "Target File: $FILENAME"
echo "--------------------------------------------------"

# Run mysqldump
# --no-tablespaces is often needed if the user doesn't have PROCESS privilege
# --complete-insert for better compatibility
# --hex-blob for binary data if any
$MYSQLDUMP_PATH -u "$DB_USER" -h "$DB_HOST" \
    --no-tablespaces \
    --complete-insert \
    --hex-blob \
    --skip-comments \
    --triggers \
    "$DB_NAME" > "$FILENAME"

if [ $? -eq 0 ]; then
    echo "SUCCESS: Database exported successfully to $FILENAME"
    # Create a 'latest' symlink
    ln -sf "$(basename "$FILENAME")" "${OUTPUT_DIR}/${DB_NAME}_latest.sql"
    echo "Link created: ${OUTPUT_DIR}/${DB_NAME}_latest.sql"
else
    echo "ERROR: Database export failed!"
    exit 1
fi

echo "--------------------------------------------------"
