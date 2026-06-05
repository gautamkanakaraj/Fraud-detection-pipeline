package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type WsMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type KafkaTransactionPayload struct {
	TransactionID string  `json:"transaction_id"`
	CardNumber    string  `json:"card_number"`
	Amount        float64 `json:"amount"`
	Location      string  `json:"location"`
	Timestamp     int64   `json:"timestamp"`
}

type FraudAlertPayload struct {
	TransactionID string   `json:"transaction_id"`
	CardNumber    string   `json:"card_number"`
	Violations    []string `json:"violations"`
	SwipeCount    int64    `json:"swipe_count"`
	Timestamp     int64    `json:"timestamp"`
}

var locations = []string{"New York, NY", "London, UK", "Tokyo, JP", "San Francisco, CA", "Austin, TX", "Singapore", "Dubai, UAE", "Berlin, DE"}

func generateCard() string {
	return fmt.Sprintf("**** **** **** %04d", rand.Intn(10000))
}

func generateId() string {
	return fmt.Sprintf("tx-MOCK%d", rand.Intn(1000000))
}

func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade error: %v", err)
		return
	}
	defer conn.Close()

	log.Println("🔌 Dashboard connected to mock WebSocket server!")

	// Channel to signal shutdown of feeder loops for this connection
	done := make(chan struct{})

	// Feeder loop
	go func() {
		ticker := time.NewTicker(1500 * time.Millisecond)
		defer ticker.Stop()

		attackTicker := time.NewTicker(8000 * time.Millisecond)
		defer attackTicker.Stop()

		for {
			select {
			case <-done:
				return
			case <-ticker.C:
				// Send a standard cleared transaction
				tx := KafkaTransactionPayload{
					TransactionID: generateId(),
					CardNumber:    generateCard(),
					Amount:        rand.Float64()*500 + 10,
					Location:      locations[rand.Intn(len(locations))],
					Timestamp:     time.Now().Unix(),
				}
				msg := WsMessage{
					Type: "transaction",
					Data: tx,
				}
				bytes, _ := json.Marshal(msg)
				if err := conn.WriteMessage(websocket.TextMessage, bytes); err != nil {
					log.Printf("Write error: %v", err)
					return
				}
			case <-attackTicker.C:
				// Send an attack
				isVelocity := rand.Float64() > 0.5
				card := generateCard()
				txID := generateId()

				if isVelocity {
					// 1. Send normal transaction first
					tx := KafkaTransactionPayload{
						TransactionID: txID,
						CardNumber:    card,
						Amount:        rand.Float64()*1000 + 500,
						Location:      "Austin, TX",
						Timestamp:     time.Now().Unix(),
					}
					msg := WsMessage{
						Type: "transaction",
						Data: tx,
					}
					bytes, _ := json.Marshal(msg)
					_ = conn.WriteMessage(websocket.TextMessage, bytes)

					time.Sleep(500 * time.Millisecond)

					// 2. Send Fraud Alert
					alert := FraudAlertPayload{
						TransactionID: txID,
						CardNumber:    card,
						Violations:    []string{"Velocity limit exceeded: 4 swipes within 5-min window"},
						SwipeCount:    4,
						Timestamp:     time.Now().Unix(),
					}
					msgAlert := WsMessage{
						Type: "fraud-alert",
						Data: alert,
					}
					bytesAlert, _ := json.Marshal(msgAlert)
					if err := conn.WriteMessage(websocket.TextMessage, bytesAlert); err != nil {
						log.Printf("Write error: %v", err)
						return
					}
				} else {
					// Geospatial violation alert
					alert := FraudAlertPayload{
						TransactionID: txID,
						CardNumber:    card,
						Violations:    []string{"Geospatial mismatch: London, UK swipe mismatching New York, NY profile"},
						SwipeCount:    1,
						Timestamp:     time.Now().Unix(),
					}
					msgAlert := WsMessage{
						Type: "fraud-alert",
						Data: alert,
					}
					bytesAlert, _ := json.Marshal(msgAlert)
					if err := conn.WriteMessage(websocket.TextMessage, bytesAlert); err != nil {
						log.Printf("Write error: %v", err)
						return
					}
				}
			}
		}
	}()

	// Wait for connection to close
	for {
		if _, _, err := conn.NextReader(); err != nil {
			close(done)
			break
		}
	}
	log.Println("🔌 Dashboard disconnected from mock server.")
}

func main() {
	http.HandleFunc("/stream", handleConnection)
	log.Println("⚡ Mock WebSocket server running on port :8081 at /stream...")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
