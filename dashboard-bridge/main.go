package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/gorilla/websocket"
)

type WsMessage struct {
	Type string          `json:"type"` // "transaction" or "fraud-alert"
	Data json.RawMessage `json:"data"`
}

type Hub struct {
	clients    map[*websocket.Conn]bool
	broadcast  chan []byte
	register   chan *websocket.Conn
	unregister chan *websocket.Conn
	mu         sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		clients:    make(map[*websocket.Conn]bool),
		broadcast:  make(chan []byte, 100),
		register:   make(chan *websocket.Conn),
		unregister: make(chan *websocket.Conn),
	}
}

func (h *Hub) run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			h.mu.Lock()
			for client := range h.clients {
				client.Close()
			}
			h.mu.Unlock()
			return
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Println(" Client connected. Total connected clients:", len(h.clients))
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				client.Close()
				log.Println("Client disconnected. Total connected clients:", len(h.clients))
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				err := client.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf(" WebSocket write error: %v", err)
					client.Close()
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dashboard connections
	},
}

func startKafkaConsumer(ctx context.Context, hub *Hub) {
	config := &kafka.ConfigMap{
		"bootstrap.servers": "localhost:9092",
		"group.id":          "dashboard-bridge-group",
		"auto.offset.reset": "earliest",
	}

	consumer, err := kafka.NewConsumer(config)
	if err != nil {
		log.Fatalf(" Failed to create Kafka consumer: %v", err)
	}
	defer consumer.Close()

	topics := []string{"transactions", "fraud-alerts"}
	err = consumer.SubscribeTopics(topics, nil)
	if err != nil {
		log.Fatalf(" Failed to subscribe to topics %v: %v", topics, err)
	}

	log.Printf(" Kafka Consumer listening on topics: %v\n", topics)

	for {
		select {
		case <-ctx.Done():
			return
		default:
			msg, err := consumer.ReadMessage(100 * time.Millisecond)
			if err != nil {
				if err.(kafka.Error).Code() == kafka.ErrTimedOut {
					continue
				}
				log.Printf(" Kafka consumer read error: %v\n", err)
				continue
			}

			var msgType string
			if *msg.TopicPartition.Topic == "transactions" {
				msgType = "transaction"
			} else if *msg.TopicPartition.Topic == "fraud-alerts" {
				msgType = "fraud-alert"
			} else {
				continue
			}

			wsMsg := WsMessage{
				Type: msgType,
				Data: json.RawMessage(msg.Value),
			}

			payloadBytes, err := json.Marshal(wsMsg)
			if err != nil {
				log.Printf("Failed to serialize WS envelope: %v\n", err)
				continue
			}

			hub.broadcast <- payloadBytes
		}
	}
}

func main() {
	log.Println(" Starting Streaming Bridge...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	hub := newHub()
	go hub.run(ctx)

	go startKafkaConsumer(ctx, hub)

	http.HandleFunc("/stream", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf(" Upgrade failed: %v", err)
			return
		}
		hub.register <- conn
		
		// Keep connection alive, listen for close messages
		go func() {
			defer func() {
				hub.unregister <- conn
			}()
			for {
				if _, _, err := conn.NextReader(); err != nil {
					break
				}
			}
		}()
	})

	server := &http.Server{Addr: ":8081"}

	// Graceful shutdown listener
	sigchan := make(chan os.Signal, 1)
	signal.Notify(sigchan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigchan
		log.Println(" Graceful shutdown initiated...")
		cancel()
		
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer shutdownCancel()
		server.Shutdown(shutdownCtx)
	}()

	log.Println("⚡ Streaming Bridge API online on port :8081...")
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatalf(" Failed to start server: %v", err)
	}
	log.Println("Streaming Bridge shut down completely.")
}
