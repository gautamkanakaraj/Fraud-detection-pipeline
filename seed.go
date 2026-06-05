 //Create seed.go in your root directory. This program populates Redis Hashes with static baseline context (e.g., cardholders' registered home cities). This functions exactly like the profile reference stores utilized in enterprise setups.

//go:build ignore
package main

import (
	"context"
	"fmt"
	"log"
	"fraud-detection-pipeline/utils"
)

func main() {
	ctx := context.Background()
	rdb := utils.InitRedis(ctx)
	defer rdb.Close()

	fmt.Println(" Connected to Redis Store. Beginning reference initialization...")

	// Mock Dataset mapping Card Numbers to customer file hashes
	mockProfiles := map[string]map[string]interface{}{
		"4111111111111111": {"home_city": "New York", "status": "active"},
		"5222222222222222": {"home_city": "London", "status": "active"},
		"3777777777777777": {"home_city": "Tokyo", "status": "suspended"},
	}

	// Utilizing a fast atomic database pipeline to ingest profiles concurrently
	pipe := rdb.Pipeline()
	for cardNumber, profile := range mockProfiles {
		pipe.HSet(ctx, cardNumber, profile)
	}

	if _, err := pipe.Exec(ctx); err != nil {
		log.Fatalf("Critical error writing profile dataset: %v", err)
	}

	fmt.Println("Redis Hashes successfully populated with customer baseline contexts!")
}