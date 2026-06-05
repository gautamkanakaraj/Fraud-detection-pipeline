package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/redis/go-redis/v9"
)

// Transaction matches the Zone 1 JSON data contract schema
type Transaction struct {
	TransactionID string  `json:"transaction_id"`
	CardNumber    string  `json:"card_number"`
	Amount        float64 `json:"amount"`
	Location      string  `json:"location"`
	Timestamp     int64   `json:"timestamp"`
}

const (
	kafkaBroker = "localhost:9092"
	consumerGroup = "fraud-processor-group"
	kafkaTopic    = "transactions"
	workerCount   = 50
)

func main() {
	log.Println("🕵️ Starting Core Rule Processing Engine...")

	// 1. Initialize Redis Client Connection Pool
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		log.Fatalf("❌ Processor failed to connect to Redis: %v", err)
	}
	log.Println("✅ Processor connected to Redis storage layer.")

	// 2. Initialize Apache Kafka Consumer
	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": kafkaBroker,
		"group.id":          consumerGroup,
		"auto.offset.reset": "earliest",
	})
	if err != nil {
		log.Fatalf("❌ Failed to instantiate Kafka consumer: %v", err)
	}
	defer consumer.Close()

	if err := consumer.SubscribeTopics([]string{kafkaTopic}, nil); err != nil {
		log.Fatalf("❌ Failed to subscribe to topic %s: %v", kafkaTopic, err)
	}

	// 3. Construct the Thread-Safe Job Allocation Channel (Buffered for Throttle Protection)
	taskChannel := make(chan Transaction, 1000)

	// 4. Spawn the Fixed Pool of Persistent Worker Goroutines
	for i := 1; i <= workerCount; i++ {
		go transactionWorker(i, rdb, taskChannel)
	}
	fmt.Printf("🚀 Worker Pool Active with %d synchronized background Goroutines.\n", workerCount)

	// 5. Wire up System Interruption Listeners for Graceful Shutdowns
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	// 6. The Infinite Ingestion Loop (The Boss Thread)
	run := true
	for run {
		select {
		case sig := <-sigchan:
			fmt.Printf("⚠️ Caught signal %v: Commencing graceful shutdown...\n", sig)
			run = false
		default:
			// Poll the Kafka Broker for incoming card swipes
			msg, err := consumer.ReadMessage(100 * time.Millisecond)
			if err != nil {
				// Intercept timeouts safely without crashing loop
				if err.(kafka.Error).Code() == kafka.ErrTimedOut {
					continue
				}
				log.Printf("❌ Kafka Consumption error occurred: %v\n", err)
				continue
			}

			// De-serialize the raw byte stream into our safe memory struct
			var tx Transaction
			if err := json.Unmarshal(msg.Value, &tx); err != nil {
				log.Printf("❌ Skipping invalid payload format: %v\n", err)
				continue
			}

			// Hand off task to the pool via the channel (Non-blocking Boss handoff)
			taskChannel <- tx
		}
	}

	// Clean up allocations cleanly
	close(taskChannel)
	log.Println("🛑 Core Rule Processing Engine cleanly terminated.")
}