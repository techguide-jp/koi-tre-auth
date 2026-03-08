export interface DashboardResponse {
  uid: string
  remainingUsage: number
  limit: number
  lastLlmText: string | null
  lastOperationAt: string | null
}

export interface DifyAccessKeyResponse {
  accessKey: string
  expiresAt: string
}

export interface SyncUserRequest {
  email?: string | null
  displayName?: string | null
  photoUrl?: string | null
}

export interface DifyOperationRequest {
  uid: string
  conversationId: string
  llmText: string
  query: string
}
