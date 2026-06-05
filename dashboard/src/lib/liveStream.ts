import { useEffect, useRef, useState } from 'react';
import type { Transaction } from './types';

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

export interface FraudAlertPayload {
  transaction_id: string;
  card_number: string;
  violations: string[];
  swipe_count: number;
  timestamp: number;
}

export interface KafkaTransactionPayload {
  transaction_id: string;
  card_number: string;
  amount: number;
  location: string;
  timestamp: number;
}

interface UseLiveStreamProps {
  enabled: boolean;
  onTransaction: (tx: Transaction) => void;
  onFraudAlert: (alert: FraudAlertPayload) => void;
}

export function useLiveStream({ enabled, onTransaction, onFraudAlert }: UseLiveStreamProps) {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = () => {
    if (!enabled) return;

    setStatus('CONNECTING');
    const ws = new WebSocket('ws://localhost:8081/stream');
    socketRef.current = ws;

    ws.onopen = () => {
      setStatus('CONNECTED');
      reconnectAttemptsRef.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const envelope = JSON.parse(event.data);
        if (envelope.type === 'transaction') {
          const payload = envelope.data as KafkaTransactionPayload;
          const tx: Transaction = {
            id: payload.transaction_id,
            card: payload.card_number,
            amount: payload.amount,
            location: payload.location,
            status: 'CLEARED',
            timestamp: new Date(payload.timestamp * 1000),
          };
          onTransaction(tx);
        } else if (envelope.type === 'fraud-alert') {
          const payload = envelope.data as FraudAlertPayload;
          onFraudAlert(payload);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setStatus('DISCONNECTED');
      if (enabled) {
        const backoff = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, backoff);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      ws.close();
    };
  };

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setStatus('DISCONNECTED');
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled]);

  return { status };
}
