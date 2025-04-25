import os
from datetime import datetime
from typing import List, Optional, Dict, Any, Union
from uuid import UUID

from pydantic import BaseModel, Field, validator, EmailStr, root_validator, field_validator


# Question schemas
class QuestionRequest(BaseModel):
    """Schema for question requests."""
    content: str = Field(..., min_length=1)
    thread_id: str = Field(..., description="Use 'create' para criar nova thread ou forneça o ID de uma thread existente")
    instructions: Optional[str] = Field(default=None, description="Optional instructions for the assistant")
    user_id: Optional[EmailStr] = Field(default=None, description="Email do usuário (opcional, usa o email do assistente se não fornecido)")
    vector_store_id: Optional[str] = Field(default=None, description="ID opcional do vector store a ser utilizado")

    @field_validator("content")
    @classmethod
    def content_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError("Content cannot be empty")
        return v.strip()

    model_config = {
        "json_schema_extra": {
            "example": {
                "content": "Qual é a fisiopatologia da poliomielite?",
                "thread_id": "create",
                "instructions": None
            }
        }
    }
    
    

class QuestionResponse(BaseModel):
    """Schema for question responses."""
    answer: str
    thread_id: str
    assistant_id: str
    user_id: str
    vector_store_id: str
    token_usage_id: Optional[UUID] = Field(None, description="UUID do registro de token_usage no Supabase")