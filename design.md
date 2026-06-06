# High-Throughput Real-Time Financial Fraud Interdiction Pipeline
## System Design Document

This document outlines the architectural blueprints, data flows, and design decisions underpinning the high-throughput, real-time financial fraud detection and interdiction pipeline.

---

## 1. System Architecture Diagram

Below is the structural layout demonstrating how transaction payloads flow from payment terminals through the ingestion layer, partition backbone, memory multiplexer, worker grid, and shared storage layers:

```text
==================================================================================
                     ZONE 1: THE INGESTION GATEWAY (PRODUCER)
==================================================================================
                     [ Payment Terminal / Client App ]
                                    |
                        (POST /api/v1/transactions)
                                    |
                                    v
                         [ Go REST API Gateway ]
                                    |
                 Message published with Key = "card_number"
                                    |
                                    v
==================================================================================
                     KAFKA CENTRAL TOPIC: "transactions"
==================================================================================
    [ Partition 0 ]      [ Partition 1 ]      [ Partition 2 ]      [ Partition 3 ]
           |                    |                    |                    |
           +--------------------+---------+----------+--------------------+
                                          |
                                          | All 4 partitions read by
                                          v ONE single consumer daemon
==================================================================================
            ZONE 2 & 3: THE MONOLITHIC CONCURRENT ENGINE (SINGLE PROCESS)
==================================================================================
               [ Single Active Go Consumer Application (Daemon) ]
                                          |
                        [ Central Internal taskChannel ]
                                          |
              +---------------------------+---------------------------+
              |                           |                           |
              v                           v                           v
      [ Goroutine Worker 1 ]      [ Goroutine Worker 2 ]     [ Goroutine Worker 50 ]
              |                           |                           |
              +---------------------------+---------------------------+
                                          |
                 Interrogates Redis using Atomic Command Pipelines
                                          |
                                          v
==================================================================================
                           REDIS MEMORY CACHE LAYER
==================================================================================
         [(Redis Hashes: Profiles)]       [(Redis Sorted Sets: Velocity)]
```

---

## 2. Step-by-Step Architectural Pipeline Explanation

### Zone 1: Ingestion Gate
The entry point of the pipeline is a high-performance HTTP REST API written in Go. 
* **Payload Reception:** The Ingestion Gateway exposes a `/api/v1/transactions` endpoint accepting structured transaction payloads (JSON).
* **Deterministic Key Hashing:** Upon receiving a transaction, the gateway extracts the `card_number` and passes it as the routing key to the Apache Kafka producer. 
* **Chronological Ordering Guarantee:** By hashing the key modulo the number of partitions ($Hash(\text{card\_number}) \pmod 4$), the Kafka producer ensures that all transactions originating from the exact same credit card are routed to the exact same partition log. This guarantees that transaction history is evaluated sequentially in the correct chronological order, preventing out-of-order anomalies from invalidating velocity checks.

### Kafka Multi-Partition Backbone
* **Physical Logs:** The central `transactions` topic is split into four distinct physical partition logs.
* **Non-blocking Appends:** Because Kafka partitions are append-only commit logs, they allow non-blocking disk writes. The ingestion service can push messages into the log at raw network speed, decoupling ingestion throughput from downstream database query latency and processing bottlenecks.

### The Main Ingestion Thread (The Collector)
* **Dedicated Fast-Poller:** Within the core processing engine, a single active Go consumer daemon manages subscription topics.
* **Concurrence across Partitions:** Rather than spawning multiple consumer group members across the network, this single daemon coordinates polling across all 4 partitions. Its sole responsibility is fast polling: pulling raw binary payloads off the wire and passing them straight into local memory.

### The taskChannel Multiplexer
* **Zero Network Backpressure:** Once a message is fetched by the main ingestion thread, it is unmarshaled into a Go memory struct and immediately dispatched to a buffered Go channel (`taskChannel`).
* **RAM Transfer Speed:** This handoff occurs in sub-microseconds. Because the main collector thread does not block on database queries or rules evaluation, it never halts partition polling, eliminating TCP/socket backpressure on the Kafka brokers.

### The Concurrent Worker Grid
* **Persistent Goroutines:** A fixed pool of 50 persistent background Goroutine workers block-listens to the `taskChannel` multiplexer.
* **Atomic Redis Operations:** Upon taking ownership of a data frame, a worker thread invokes rule evaluation logic against a centralized Redis instance. To maximize network round-trip efficiency, the worker runs atomic command pipelines combining multiple read/write operations (e.g., `HGET` for user profile geo-fencing, and `ZADD`, `ZREMRANGEBYSCORE`, `ZCARD` for sliding-window transaction velocity monitoring).

---

## 3. Architectural Decision Log (ADL): Why We Scaled Vertically instead of Horizontally

To maximize performance, resource efficiency, and cluster reliability, the pipeline utilizes **Vertical Concurrent Scaling** (Single-Process Multithreading) over standard **Horizontal Scaling** (multi-container microservice deployments). Below are the five core engineering justifications for this architectural layout:

### Justification A: Smashing Through Kafka's Hard Partition Ceiling (The Idle Rule)
Kafka enforces a fundamental partition consumption constraint: **a single partition cannot be split between multiple consumers within the exact same consumer group**. 
* **Horizontal Scaling Limitation:** Because our `transactions` topic has a ceiling of 4 physical partitions, traditional horizontal scaling would cap the cluster at a maximum of 4 active containers. Spawning a 5th container would be useless, as it would sit idle with no assigned partitions.
* **Vertical Solution:** By scaling vertically inside Go, our single consumer daemon claims all 4 partitions but instantly multiplexes the fetched records to 50 active, parallel Goroutines. This bypasses the Kafka partition bottleneck, enabling high levels of processing concurrency on standard hardware.

### Justification B: Sub-Microsecond Memory Pointers vs Network Overhead
* **Horizontal Cost:** Distributing tasks across a horizontal network of microservices requires serializing data (e.g., to JSON or Protobuf) and transferring it over Docker networks, virtual switches, or physical network cards. This introduces substantial network I/O overhead and CPU serialization costs.
* **Vertical Solution:** Go's channel-based communication operates entirely within the host machine's RAM. Instead of copying data, workers receive memory pointers to already-unmarshaled structs in nanoseconds, eliminating network-induced latency.

### Justification C: Eliminating Catastrophic Cluster Rebalance Stalls
* **Horizontal Cost:** In a horizontally scaled system, when a container scales out, crashes, or is restarted, Kafka triggers a "Consumer Group Rebalance." During a rebalance, the entire consumer group freezes consumption to recalculate partition ownership, stopping processing for seconds at a time. In financial transaction processing, this latency spike causes critical timeouts.
* **Vertical Solution:** The single consumer daemon maintains a locked, continuous, and unbroken lease on all 4 partitions. Workers are spawned and managed internally, ensuring 100% processing uptime with zero rebalance events.

### Justification D: Goroutine Memory Footprint vs Container Bloat
* **Horizontal Cost:** Running 50 separate microservice containers duplicates the overhead of operating systems, container runtimes, connection pools, and runtime environments (JVMs, Node VMs, or Go runtimes), consuming gigabytes of system memory.
* **Vertical Solution:** Go's runtime scheduler utilizes cooperative green threads (Goroutines) which start with a minimal stack size of only **2 KB**. Running 50 persistent workers inside a single process consumes virtually zero extra memory overhead, letting the system use almost all available CPU cycles for processing transactions.

### Justification E: Streamlined Connection Pooling Control
* **Horizontal Cost:** If 50 microservice instances were deployed horizontally, each would require its own Redis connection pool to handle concurrent traffic. Fifty separate pools would quickly consume hundreds of database sockets, risking Redis socket exhaustion and performance degradation.
* **Vertical Solution:** By running a single Go process, the engine opens a single, highly optimized, compact Redis client connection pool. All 50 local worker threads share this single pool safely, reducing connection overhead and maintaining a light footprint on the database cache.
