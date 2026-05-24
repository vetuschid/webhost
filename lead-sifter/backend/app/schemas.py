from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ApiKeyIn(BaseModel):
    provider: Literal["openai", "anthropic", "apollo", "ghl_pit", "ghl_location_id"]
    value: str


class ApiKeyOut(BaseModel):
    provider: str
    last4: str
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class TestResult(BaseModel):
    ok: bool
    detail: str | None = None
    data: dict[str, Any] | None = None


class ContextBundleIn(BaseModel):
    name: str
    sources: list[str] = Field(default_factory=list)
    inline_files: list[dict[str, str]] = Field(default_factory=list)  # [{name, content}]
    folder_path: str | None = None
    qualified_field: str | None = None


class ContextBundleOut(BaseModel):
    id: int
    name: str
    sources: list[str]
    content_hash: str
    output_schema: dict[str, Any]
    qualified_field: str
    created_at: datetime
    preview: str | None = None
    model_config = ConfigDict(from_attributes=True)


class ApolloFilters(BaseModel):
    person_titles: list[str] = Field(default_factory=list)
    person_locations: list[str] = Field(default_factory=list)
    organization_locations: list[str] = Field(default_factory=list)
    organization_num_employees_ranges: list[str] = Field(default_factory=list)
    q_keywords: str | None = None
    per_page: int = 100
    max_pages: int = 5
    enrich_emails: bool = False


class LeadOut(BaseModel):
    id: int
    run_id: int
    source: str
    first_name: str | None
    last_name: str | None
    email: str | None
    phone: str | None
    title: str | None
    company: str | None
    domain: str | None
    linkedin_url: str | None
    city: str | None
    state: str | None
    country: str | None
    model_config = ConfigDict(from_attributes=True)


class ColumnMap(BaseModel):
    # csv column header -> canonical field name OR "extra.<key>"
    mapping: dict[str, str]


class GhlTarget(BaseModel):
    create_contact: bool = True
    pipeline_id: str | None = None
    stage_id: str | None = None
    tags: list[str] = Field(default_factory=list)
    workflow_id: str | None = None


class RunStart(BaseModel):
    model: str
    provider: Literal["openai", "anthropic"]
    bundle_id: int
    max_parallel: int = 5
    streaming: bool = True
    ghl_target: GhlTarget = Field(default_factory=GhlTarget)
    source: Literal["apollo", "csv"]
    apollo: ApolloFilters | None = None  # required if source == apollo
    leads_payload_id: int | None = None  # csv lead-staging id, if source == csv


class RunOut(BaseModel):
    id: int
    model: str
    provider: str
    bundle_id: int
    source: str
    status: str
    summary: dict[str, Any]
    ghl_target: dict[str, Any]
    created_at: datetime
    finished_at: datetime | None
    model_config = ConfigDict(from_attributes=True)


class LeadResultOut(BaseModel):
    id: int
    run_id: int
    lead_id: int
    status: str
    output: dict[str, Any]
    reasoning: str | None
    error: str | None
    pushed_to_ghl: bool
    ghl_result: dict[str, Any]
    model_config = ConfigDict(from_attributes=True)


class ChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatStartIn(BaseModel):
    model: str
    provider: Literal["openai", "anthropic"]
    bundle_id: int | None = None
    title: str | None = None


class ChatSendIn(BaseModel):
    content: str
    streaming: bool = True


class ChatSessionOut(BaseModel):
    id: int
    title: str
    model: str
    provider: str
    bundle_id: int | None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GhlPushSelection(BaseModel):
    lead_result_ids: list[int]


class ToolMapOut(BaseModel):
    upsert_contact: str | None
    create_opportunity: str | None
    add_tags: str | None
    add_to_workflow: str | None
    raw_tools: list[str]
