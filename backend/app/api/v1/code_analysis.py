"""Authenticated code analysis, reports, and per-finding developer feedback."""
from __future__ import annotations

import difflib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user
from app.db.session import get_db
from app.models.code_analysis import CodeAnalysisReport
from app.models.code_analysis_feedback import CodeAnalysisFeedback
from app.models.user import User
from app.services.code_analysis_service import analyze_source

router = APIRouter(prefix="/code-analysis", tags=["code-analysis"])


class AnalyzeRequest(BaseModel):
    source_code: str = Field(min_length=1, max_length=100_000)
    language: str = Field(pattern="^(python|java)$")
    filename: str = Field(default="untitled", min_length=1, max_length=255)
    include_ai_review: bool = True


class FeedbackRequest(BaseModel):
    finding_index: int = Field(ge=0)
    verdict: Literal["correct", "false_positive", "partially_correct"]
    comment: str | None = Field(default=None, max_length=2000)


@router.post("/analyze")
async def analyze_code(
    payload: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    try:
        result = analyze_source(payload.source_code, payload.language, payload.filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    ai_review: dict[str, Any] = {
        "status": "not_requested",
        "summary": "AI review was not requested.",
        "suggestions": [],
        "verification_policy": "AI output is advisory and does not remove or downgrade deterministic findings.",
    }
    if payload.include_ai_review:
        try:
            from app.services.ai_router import route_and_review

            source_diff = "".join(difflib.unified_diff(
                [], [f"{line}\n" for line in payload.source_code.splitlines()],
                fromfile="a/empty", tofile=f"b/{payload.filename}",
            ))
            finding_context = json.dumps(
                [
                    {
                        "rule_id": item["rule_id"],
                        "title": item["title"],
                        "line": item["line"],
                        "severity": item["severity"],
                        "confidence_score": item.get("confidence_score"),
                    }
                    for item in result["findings"]
                    if item["severity"] != "info"
                ],
                ensure_ascii=False,
            )
            review = await route_and_review(
                source_diff + "\n\nStatic-analysis findings to independently consider (do not assume they are correct):\n" + finding_context
            )
            routing = getattr(review, "routing_metadata", {}) or {}
            ai_review = {
                "status": "skipped" if getattr(review, "k_samples", 0) == 0 else "completed",
                "summary": review.summary,
                "suggestions": review.suggestions,
                "model_used": review.model_used,
                "category": review.category,
                "severity": review.severity,
                "parallel_calls": getattr(review, "k_samples", 1),
                "rag_available": routing.get("rag_available"),
                "verification_policy": "AI output is advisory. Static findings remain visible until changed by an explicit rule update or human review.",
            }
        except Exception as exc:  # Keep deterministic analysis available if providers/RAG fail.
            ai_review = {
                "status": "unavailable",
                "summary": "Static analysis completed, but the AI provider could not complete this review.",
                "suggestions": [],
                "detail": str(exc)[:300],
                "verification_policy": "AI output is advisory and does not affect deterministic findings.",
            }

    report = CodeAnalysisReport(
        user_id=user.id,
        filename=payload.filename,
        language=result["language"],
        quality_score=result["quality_score"],
        issue_count=result["issue_count"],
        findings=result["findings"],
        ai_review=ai_review,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    result.update({
        "id": str(report.id),
        "created_at": report.created_at.isoformat() if report.created_at else datetime.now(timezone.utc).isoformat(),
        "ai_review": ai_review,
    })
    return result


@router.get("/history")
async def analysis_history(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[dict[str, Any]]:
    rows = await db.execute(
        select(CodeAnalysisReport)
        .where(CodeAnalysisReport.user_id == user.id)
        .order_by(desc(CodeAnalysisReport.created_at))
        .limit(limit)
    )
    return [{
        "id": str(row.id), "filename": row.filename, "language": row.language,
        "quality_score": row.quality_score, "issue_count": row.issue_count,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    } for row in rows.scalars().all()]


@router.post("/{report_id}/feedback")
async def submit_analysis_feedback(
    report_id: uuid.UUID,
    payload: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    report = await db.scalar(select(CodeAnalysisReport).where(
        CodeAnalysisReport.id == report_id,
        CodeAnalysisReport.user_id == user.id,
    ))
    if report is None:
        raise HTTPException(status_code=404, detail="Analysis report not found.")

    findings = report.findings or []
    if payload.finding_index >= len(findings):
        raise HTTPException(status_code=422, detail="Finding index is outside this report.")

    feedback = await db.scalar(select(CodeAnalysisFeedback).where(
        CodeAnalysisFeedback.report_id == report_id,
        CodeAnalysisFeedback.user_id == user.id,
        CodeAnalysisFeedback.finding_index == payload.finding_index,
    ))
    now = datetime.now(timezone.utc)
    if feedback is None:
        feedback = CodeAnalysisFeedback(
            report_id=report_id,
            user_id=user.id,
            finding_index=payload.finding_index,
            verdict=payload.verdict,
            comment=payload.comment,
        )
        db.add(feedback)
    else:
        feedback.verdict = payload.verdict
        feedback.comment = payload.comment
        feedback.updated_at = now

    await db.commit()
    return {
        "status": "saved",
        "finding_index": payload.finding_index,
        "verdict": payload.verdict,
    }


@router.get("/feedback/summary")
async def analysis_feedback_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> dict[str, int]:
    rows = await db.execute(
        select(CodeAnalysisFeedback.verdict, func.count(CodeAnalysisFeedback.id))
        .where(CodeAnalysisFeedback.user_id == user.id)
        .group_by(CodeAnalysisFeedback.verdict)
    )
    summary = {"correct": 0, "false_positive": 0, "partially_correct": 0}
    for verdict, count in rows.all():
        summary[str(verdict)] = int(count)
    return summary


@router.get("/{report_id}")
async def get_analysis_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> dict[str, Any]:
    row = await db.scalar(select(CodeAnalysisReport).where(
        CodeAnalysisReport.id == report_id,
        CodeAnalysisReport.user_id == user.id,
    ))
    if row is None:
        raise HTTPException(status_code=404, detail="Analysis report not found.")
    return {
        "id": str(row.id), "filename": row.filename, "language": row.language,
        "quality_score": row.quality_score, "issue_count": row.issue_count,
        "findings": row.findings, "ai_review": row.ai_review,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
