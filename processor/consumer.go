package processor
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"time"

	"fraud-detection-pipeline/utils"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/redis/go-redis/v9"
)

// Transaction maps the streaming credit card transaction payload contract
type Transaction struct {
	TransactionID string  `json:"transaction_id"`
	CardNumber    string  `json:"card_number"`
	Amount        float64 `json:"amount"`
	Location      string  `json:"location"`
	Timestamp     int64   `json:"timestamp"`
}

// FraudAlert represents the aggregated real-time anomaly output payload
type FraudAlert struct {
	CardNumber    string   `json:"card_number"`
	TransactionID string   `json:"transaction_id"`
	Amount        float64  `json:"amount"`
	Location      string   `json:"location"`
	Timestamp     int64    `json:"timestamp"`
	Violations    []string `json:"violations"`
}

var kafkaProducer *kafka.Producer
const (
	inputTopic  = "transactions"
	alertTopic  = "fraud-alerts"
)

func main() {
	ctx := context.Background()

	// 1. Initialize our shared Redis connection client utility pool
	rdb := utils.InitRedis(ctx)
	defer rdb.Close()

	// 2. Initialize a dedicated Kafka Producer to dispatch derived downstream fraud alerts
	var err error
	kafkaProducer, err = kafka.NewProducer(&kafka.ConfigMap{
		"bootstrap.servers": "localhost:9092",
		"acks":              "all",
	})
	if err != nil {
		log.Fatalf(" Processor failed to spin up Kafka Producer client: %v", err)
	}
	defer kafkaProducer.Close()

	// 3. Configure the consumer group engine to stream the input topic chronologically
	consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers": "localhost:9092",
		"group.id":          "fraud_processor_group", // Scaling consumer partition worker threads
		"auto.offset.reset": "earliest",              // Reprocess from head of the log if state is lost
	})
	if err != nil {
		log.Fatalf(" Failed to instantiate Kafka Consumer group element: %v", err)
	}
	defer consumer.Close()

	// Subscribe strictly to the incoming payment logs topic channel
	if err := consumer.SubscribeTopics([]string{inputTopic}, nil); err != nil {
		log.Fatalf(" Failed subscribing to topic %s: %v", inputTopic, err)
	}

	fmt.Println(" Core Rule Processing Engine online. Awaiting real-time transaction swipes...")

	for {
		// Poll the cluster partitions continuously with a 100ms checkout interval
		msg, err := consumer.ReadMessage(100 * time.Millisecond)
		if err != nil {
			continue // System timeout reached without activity, recycle the loop
		}

		var tx Transaction
		// Unmarshal the incoming raw log byte stream directly into a safe structured reference block
		if err := json.Unmarshal(msg.Value, &tx); err != nil {
			fmt.Printf(" Skipped malformed transaction message schema: %v\n", err)
			continue
		}

		// Leverage an asynchronous Goroutine worker thread per event to eliminate pipeline backpressure
		go evaluateTransactionTelemetry(ctx, rdb, tx)
	}
}

func evaluateTransactionTelemetry(ctx context.Context, rdb *redis.Client, tx Transaction) {
	var ruleViolations []string

	// =========================================================================
	// ZONE 2: RULE 1 - Geospatial Baseline Context Check (Redis Hashes)    uses HGetAal to fetch the entire hash map of the consumer profile in one call, then performs in-memory logic to evaluate geospatial parameters. This is more efficient than multiple round-trip calls for individual fields.
	// =========================================================================
	// Fire a sub-millisecond lookup to fetch static consumer parameters via their card number key
	profile, err := rdb.HGetAll(ctx, tx.CardNumber).Result()
	if err == nil && len(profile) > 0 {
		homeCity := profile["home_city"]
		// Flag an immediate geospatial alert if the current terminal location falls outside home parameters
		if homeCity != "" && tx.Location != homeCity {
			violationMsg := fmt.Sprintf("Geospatial Violation: Card swiped in %s, registered home base is %s", tx.Location, homeCity)
			ruleViolations = append(ruleViolations, violationMsg)
			fmt.Printf(" [GEOSPATIAL WARN] Card %s -> Swiped at %s location.\n", tx.CardNumber, tx.Location)
		}
	}

	// =========================================================================
	// ZONE 2: RULE 2 - 5-Minute Sliding Window Velocity Check (Redis Sorted Sets)
	// =========================================================================
	zsetKey := fmt.Sprintf("velocity:%s", tx.CardNumber)
	nowSeconds := tx.Timestamp
	fiveMinutesAgo := nowSeconds - 300 // 5 Minute calculation window

	// Run an atomic multi-command database pipeline block to optimize connection metrics
	pipe := rdb.Pipeline()
	// Step A: Append the incoming transaction context into the card's dedicated sorted set
	pipe.ZAdd(ctx, zsetKey, redis.Z{Score: float64(tx.Timestamp), Member: tx.TransactionID})
	// Step B: Atomically trim the moving history set by evicting items older than 5 minutes ago
	pipe.ZRemRangeByScore(ctx, zsetKey, "-inf", strconv.FormatInt(fiveMinutesAgo, 10))
	// Step C: Fetch the exact size count of active transactions remaining inside this sliding timeframe
	zcardCall := pipe.ZCard(ctx, zsetKey)
	// Step D: Apply a rolling TTL window to prevent stale data sets from causing RAM memory leakage
	pipe.Expire(ctx, zsetKey, 15*time.Minute)

	if _, err := pipe.Exec(ctx); err != nil {
		fmt.Printf("❌ Failed executing Redis atomic transaction window pipeline logic: %v\n", err)
		return
	}

	// Read the numerical evaluation output returned directly from our pipeline execution sequence
	velocityCount := zcardCall.Val()
	if velocityCount > 3 {
		violationMsg := fmt.Sprintf("Velocity Breach: High activity spike detected! %d transactions handled within 5 minutes", velocityCount)
		ruleViolations = append(ruleViolations, violationMsg)
		fmt.Printf(" [VELOCITY ALERT] Card %s broke velocity parameters! Swipe Count: %d\n", tx.CardNumber, velocityCount)
	}

	// =========================================================================
	// ZONE 3: Aggregator & Downstream Interdiction Logic Dispatches
	// =========================================================================
	if len(ruleViolations) > 0 {
		synthesizeAndPublishAlert(tx, ruleViolations)
	} else {
		fmt.Printf(" Transaction %s verified as clean. Moving metrics updated safely.\n", tx.TransactionID)
	}
}

func synthesizeAndPublishAlert(tx Transaction, violations []string) {
	alert := FraudAlert{
		CardNumber:    tx.CardNumber,
		TransactionID: tx.TransactionID,
		Amount:        tx.Amount,
		Location:      tx.Location,
		Timestamp:     tx.Timestamp,
		Violations:    violations,
	}

	alertBytes, err := json.Marshal(alert)
	if err != nil {
		fmt.Printf(" Failed to serialize anomaly fraud output metadata: %v\n", err)
		return
	}

	// Publish the structured alert to our downstream fraud-alerts event topic stream
	err = kafkaProducer.Produce(&kafka.Message{
		TopicPartition: kafka.TopicPartition{Topic: &alertTopic, Partition: kafka.PartitionAny},
		Value:          alertBytes,
		Key:            []byte(tx.CardNumber),
	}, nil)

	if err != nil {
		fmt.Printf(" Failed critical log append failure on fraud alert channel: %v\n", err)
	} else {
		fmt.Printf("Downstream Alert Synthesized: Fraud warning dispatched safely to topic [%s].\n", alertTopic)
	}
}