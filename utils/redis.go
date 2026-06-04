package utils

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

// InitRedis configures and returns a production-grade Redis client pool
func InitRedis(ctx context.Context) *redis.Client {
	rdb := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379", // Connected to our Docker container port
		Password: "",               // No password set in our compose infrastructure
		DB:       0,                // Use default database zero
	})

	// Run a ping sanity check to verify connection readiness
	if _, err := rdb.Ping(ctx).Result(); err != nil {
		log.Fatalf("❌ Failed to establish connection to Redis: %v", err)
	}

	return rdb
}