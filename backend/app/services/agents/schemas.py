from pydantic import BaseModel, Field
from typing import List, Literal

class CriticOutput(BaseModel):
    criticisms: List[str] = Field(default_factory=list, description="List of structural discrepancies or criticisms.")
    has_discrepancies: bool = Field(..., description="True if any gaps or contradictions were identified.")

class EvidenceVerdict(BaseModel):
    evidence_index: int = Field(..., description="0-indexed position of the evidence snippet.")
    supports_claim: bool = Field(..., description="True if this specific evidence supports the claim.")
    contradicts_claim: bool = Field(..., description="True if this specific evidence contradicts the claim.")

class VerifierOutput(BaseModel):
    verdict_map: List[EvidenceVerdict] = Field(..., description="Verdict map mapping each evidence item index to boolean flags.")

class JudgeOutput(BaseModel):
    explanation: str = Field(..., description="Detailed natural language explanation justifying the verdict.")

class GroundedCorrection(BaseModel):
    statement: str = Field(..., description="A short correction statement based on retrieved evidence.")
    file_references: List[str] = Field(default_factory=list, description="Supporting file paths with line references (e.g. ['security.py:L12-L24']).")
    confidence: Literal["strong", "tentative"] = Field(..., description="Label indicating whether the correction is strong or tentative.")
