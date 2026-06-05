export type TransactionStatus = 'CLEARED' | 'GEOSPATIAL_VIOLATION' | 'VELOCITY_BREACH';

export interface Transaction {
  id: string;
  card: string;
  amount: number;
  location: string;
  status: TransactionStatus;
  subtext?: string;
  timestamp: Date;
}
