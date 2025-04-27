export interface QuestionRequest {
  content: string
  thread_id: string // 'create' para nova thread ou ID existente
  instructions?: string
  user_id?: string // EmailStr (string em TS)
  vector_store_id?: string
}

export interface QuestionResponse {
  content: string
  thread_id: string
  assistant_id: string
  user_id: string
  vector_store_id: string
  token_usage_id?: string // UUID (string em TS)
}
