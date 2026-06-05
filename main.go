package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Transaction maps the streaming credit card transaction schema contract
type Transaction struct {
	TransactionID string  `json:"transaction_id"`  // converting to string for easier Kafka key routing
	CardNumber    string  `json:"card_number"`
	Amount        float64 `json:"amount"`
	Location      string  `json:"location"`
	Timestamp     int64   `json:"timestamp"` // Unix Epoch time for calculations
}

var producer *kafka.Producer

var kafkaTopic = "transactions" // ensuring the kalfa topic 

func main() {
	var err error
	// Initialize high-performance confluent-kafka-go producer client
	producer, err = kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": "localhost:9092", // Local Kafka cluster broker address
		"acks":              "all",            // Ensure full broker cluster acknowledgements
	})
	if err != nil {
		log.Fatalf(" Failed to spin up Kafka Producer instance: %v", err)
	}
	defer producer.Close()

	// Handle delivery report logging asynchronously using a background Goroutine channel
	go func() {
		for e := range producer.Events() {
			switch ev := e.(type) {
			case *kafka.Message:
				if ev.TopicPartition.Error != nil {
					fmt.Printf(" Message delivery failure: %v\n", ev.TopicPartition.Error)
				} else {
					fmt.Printf(" Event safely dispatched to partition %d at offset %s\n",
						ev.TopicPartition.Partition, ev.TopicPartition.Offset)
				}
			}
		}
	}()

	// Register HTTP Route handler and open the Ingestion Server port
	http.HandleFunc("/api/v1/transactions", handleTransactionIngest)

	fmt.Println("⚡ Ingestion API Engine online, listening on port :8080...")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleTransactionIngest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "HTTP Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	var tx Transaction
	// Decode incoming transaction JSON directly into structural Go memory block
	if err := json.NewDecoder(r.Body).Decode(&tx); err != nil {
		http.Error(w, "Malformed JSON Schema Payload", http.StatusBadRequest)
		return
	}

	// Validate baseline data fields
	if tx.CardNumber == "" || tx.TransactionID == "" || tx.Location == "" {
		http.Error(w, "Missing mandatory validation attributes", http.StatusUnprocessableEntity)
		return
	}

	// Enforce auto-generation of Unix Epoch timestamps if missing from client
	if tx.Timestamp == 0 {
		tx.Timestamp = time.Now().Unix()
	}

	// Re-marshal validated struct into byte stream for Kafka delivery log append
	payloadBytes, _ := json.Marshal(tx)

	// Produce message explicitly using CardNumber as the Routing Key partition lock
	err := producer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &kafkaTopic, Partition: kafka.PartitionAny},
		Value:          payloadBytes,
		Key:            []byte(tx.CardNumber), // Routing key string cast to bytes
	}, nil)

	if err != nil {
		http.Error(w, "Internal Log Append Failure", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	w.Write([]byte(`{"status":"Dispatched","message":"Transaction sent to streaming topic pipeline"}`))
}
