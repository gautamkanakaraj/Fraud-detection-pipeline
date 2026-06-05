for i in {1..5}; do
  tx_id="tx_attack_00${i}"
  timestamp=$(date +%s)
  
  echo " Unleashing Swipe #${i} ($tx_id)..."
  
  curl -s -X POST http://localhost:8080/api/v1/transactions \
    -H "Content-Type: application/json" \
    -d "{
      \"transaction_id\": \"$tx_id\",
      \"card_number\": \"4111111111111111\",
      \"amount\": 45.00,
      \"location\": \"New York\",
      \"timestamp\": $timestamp
    }"
    
  echo -e "\n----------------------------------------"
  sleep 0.2
done