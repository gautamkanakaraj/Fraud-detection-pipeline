package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/redis/go-redis/v9"
)

// FraudAlert matches our downstream output data contract schema
type FraudAlert struct {
	TransactionID string   `json:"transaction_id"`
	CardNumber    string   `json:"card_number"`
	Violations    []string `json:"violations"`
	SwipeCount    int64    `json:"swipe_count"`
	Timestamp     int64    `json:"timestamp"`
}

const outboundAlertTopic = "fraud-alerts"

func transactionWorker(workerID int, rdb *redis.Client, tasks <-chan Transaction) {
	// Initialize a localized Kafka Producer instance for dispatching alerts
	producer, err := kafka.NewProducer(&kafka.ConfigMap{"bootstrap.servers": "localhost:9092"})
	if err != nil {
		log.Fatalf("[Worker %d] Critical failure spawning internal Kafka producer: %v", workerID, err)
	}
	defer producer.Close()

	// Keep loop running persistently across application lifecycle
	for tx := range tasks {
		ctx := context.Background()
		var violations []string
		var currentSwipeCount int64 = 1

		// --- RULE 1: Geospatial Travel Profile Evaluation (Redis Hashes) ---
		profileKey := fmt.Sprintf("card:%s", tx.CardNumber)
		homeCity, err := rdb.HGet(ctx, profileKey, "home_city").Result()
		
		if err == nil && homeCity != "" {
			if tx.Location != homeCity {
				violations = append(violations, fmt.Sprintf("GEOSPATIAL_VIOLATION: Swiped in %s, home profile is %s", tx.Location, homeCity))
			}
		}

		// --- RULE 2: Sliding 5-Minute Velocity Window Calculation (Redis ZSET) ---
		timelineKey := fmt.Sprintf("timeline:%s", tx.CardNumber)
		nowUnix := tx.Timestamp
		fiveMinutesAgo := nowUnix - 300

		// Atomic Pipeline Execution Block
		pipe := rdb.TxPipeline()
		pipe.ZAdd(ctx, timelineKey, redis.Z{Score: float64(nowUnix), Member: tx.TransactionID})
		pipe.ZRemRangeByScore(ctx, timelineKey, "-inf", fmt.Sprintf("(%d", fiveMinutesAgo))
		zCardCall := pipe.ZCard(ctx, timelineKey)
		pipe.Expire(ctx, timelineKey, 10*time.Minute) // Prevent memory leaks via a rolling TTL buffer

		_, err = pipe.Exec(ctx)
		if err == nil {
			currentSwipeCount = zCardCall.Val()
			if currentSwipeCount > 3 {
				violations = append(violations, fmt.Sprintf("VELOCITY_BREACH: %d swipes registered inside a 5-minute sliding window", currentSwipeCount))
			}
		}

		// --- ZONE 3: Aggregator / Outbound Alert Synthesis ---
		if len(violations) > 0 {
			log.Printf("🚨 [WORKER %d ALERT] Threat intercepted on card %s! Violations: %v\n", workerID, tx.CardNumber, violations)

			alertPayload := FraudAlert{
				TransactionID: tx.TransactionID,
				CardNumber:    tx.CardNumber,
				Violations:    violations,
				SwipeCount:    currentSwipeCount,
				Timestamp:     time.Now().Unix(),
			}

			alertBytes, err := json.Marshal(alertPayload)
			if err != nil {
				log.Printf("❌ Failed to serialize fraud alert: %v\n", err)
				continue
			}

			// Stream threat notification down to the dedicated fraud-alerts topic
			err = producer.Produce(&kafka.Message{
				TopicPartition: kafka.TopicPartition{Topic: &[]string{outboundAlertTopic}[0], Partition: kafka.PartitionAny},
				Key:            []byte(tx.CardNumber),
				Value:          alertBytes,
			}, nil)
			
			if err != nil {
				log.Printf("❌ Failed to publish outbound fraud alert packet to Kafka: %v\n", err)
			}
		} else {
			log.Printf("🛡️ [WORKER %d] Transaction %s cleared successfully.\n", workerID, tx.TransactionID)
		}
	}
}