"""
Organizations REST API.

Route layout:
  POST   /orgs                              create organization
  GET    /orgs/{org}                        get organization details
  PATCH  /orgs/{org}                        update organization
  DELETE /orgs/{org}                        delete organization
  GET    /orgs/{org}/members                list members
  POST   /orgs/{org}/members               add member
  DELETE /orgs/{org}/members/{uid}          remove member
  GET    /orgs/{org}/repos                  list repositories in org
  GET    /orgs/{org}/teams                  list teams
  POST   /orgs/{org}/teams                  create team
  DELETE /orgs/{org}/teams/{team_id}        delete team
  POST   /orgs/{org}/teams/{team_id}/members  add team member
  DELETE /orgs/{org}/teams/{team_id}/members/{uid}  remove team member
"""
from __future__ import annotations
import uuid
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.dependencies import get_current_active_user, get_current_verified_user
from app.db.session import get_db
from app.models.enums import OrganizationRole, TeamRole
from app.models.organization import Organization, OrganizationMember, Team, TeamMember
from app.models.repo import Repository
from app.models.user import User

router = APIRouter(prefix="/orgs", tags=["organizations"])


class OrgCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=39)
    display_name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    avatar_url: Optional[str] = None
    website_url: Optional[str] = None


class OrgUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    avatar_url: Optional[str] = None
    website_url: Optional[str] = None


class MemberAdd(BaseModel):
    username: str
    role: OrganizationRole = OrganizationRole.MEMBER


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)


class TeamMemberAdd(BaseModel):
    username: str
    role: TeamRole = TeamRole.MEMBER


async def _get_org_or_404(name: str, db: AsyncSession) -> Organization:
    result = await db.execute(select(Organization).where(Organization.name == name))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail=f"Organization '{name}' not found.")
    return org


async def _require_org_owner(org: Organization, user: User, db: AsyncSession) -> None:
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id,
            OrganizationMember.role == OrganizationRole.OWNER,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only organization owners can perform this action.")


async def _require_org_member(org: Organization, user: User, db: AsyncSession) -> OrganizationMember:
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.organization_id == org.id,
            OrganizationMember.user_id == user.id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="You must be a member of this organization.")
    return member


def _org_to_dict(org: Organization) -> dict:
    return {
        "id": str(org.id),
        "name": org.name,
        "display_name": org.display_name,
        "description": org.description,
        "avatar_url": org.avatar_url,
        "website_url": org.website_url,
        "created_at": org.created_at.isoformat(),
    }


@router.post("", status_code=201)
async def create_org(
    payload: OrgCreate,
    current_user: Annotated[User, Depends(get_current_verified_user)],
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Organization).where(Organization.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Organization '{payload.name}' already exists.")
    org = Organization(
        name=payload.name,
        display_name=payload.display_name,
        description=payload.description,
        avatar_url=payload.avatar_url,
        website_url=payload.website_url,
        created_by=current_user.id,
    )
    db.add(org)
    await db.flush()
    db.add(OrganizationMember(organization_id=org.id, user_id=current_user.id, role=OrganizationRole.OWNER))
    await db.commit()
    await db.refresh(org)
    return _org_to_dict(org)


@router.get("/{org_name}")
async def get_org(org_name: str, current_user: Annotated[User, Depends(get_current_active_user)], db: AsyncSession = Depends(get_db)):
    return _org_to_dict(await _get_org_or_404(org_name, db))


@router.patch("/{org_name}")
async def update_org(org_name: str, payload: OrgUpdate, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    await db.commit()
    await db.refresh(org)
    return _org_to_dict(org)


@router.delete("/{org_name}", status_code=204)
async def delete_org(org_name: str, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    await db.delete(org)
    await db.commit()


@router.get("/{org_name}/members")
async def list_members(org_name: str, current_user: Annotated[User, Depends(get_current_active_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    result = await db.execute(
        select(OrganizationMember, User).join(User, User.id == OrganizationMember.user_id)
        .where(OrganizationMember.organization_id == org.id)
    )
    return [{"user_id": str(m.user_id), "username": u.username, "role": m.role.value} for m, u in result.all()]


@router.post("/{org_name}/members", status_code=201)
async def add_member(org_name: str, payload: MemberAdd, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    user_res = await db.execute(select(User).where(User.username == payload.username))
    target = user_res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail=f"User '{payload.username}' not found.")
    existing = await db.execute(select(OrganizationMember).where(OrganizationMember.organization_id == org.id, OrganizationMember.user_id == target.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User is already a member.")
    db.add(OrganizationMember(organization_id=org.id, user_id=target.id, role=payload.role))
    await db.commit()
    return {"user_id": str(target.id), "username": target.username, "role": payload.role.value}


@router.delete("/{org_name}/members/{user_id}", status_code=204)
async def remove_member(org_name: str, user_id: uuid.UUID, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    result = await db.execute(select(OrganizationMember).where(OrganizationMember.organization_id == org.id, OrganizationMember.user_id == user_id))
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Member not found.")
    await db.delete(membership)
    await db.commit()


@router.get("/{org_name}/repos")
async def list_org_repos(org_name: str, current_user: Annotated[User, Depends(get_current_active_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    result = await db.execute(select(Repository).where(Repository.org_id == org.id))
    return [{"id": str(r.id), "name": r.name, "slug": r.slug, "description": r.description, "visibility": r.visibility.value, "star_count": r.star_count, "created_at": r.created_at.isoformat()} for r in result.scalars().all()]


@router.get("/{org_name}/teams")
async def list_teams(org_name: str, current_user: Annotated[User, Depends(get_current_active_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_member(org, current_user, db)
    result = await db.execute(select(Team).where(Team.organization_id == org.id))
    return [{"id": str(t.id), "name": t.name, "description": t.description} for t in result.scalars().all()]


@router.post("/{org_name}/teams", status_code=201)
async def create_team(org_name: str, payload: TeamCreate, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    existing = await db.execute(select(Team).where(Team.organization_id == org.id, Team.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Team '{payload.name}' already exists.")
    team = Team(organization_id=org.id, name=payload.name, description=payload.description)
    db.add(team)
    await db.commit()
    await db.refresh(team)
    return {"id": str(team.id), "name": team.name, "description": team.description}


@router.delete("/{org_name}/teams/{team_id}", status_code=204)
async def delete_team(org_name: str, team_id: uuid.UUID, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    result = await db.execute(select(Team).where(Team.id == team_id, Team.organization_id == org.id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    await db.delete(team)
    await db.commit()


@router.post("/{org_name}/teams/{team_id}/members", status_code=201)
async def add_team_member(org_name: str, team_id: uuid.UUID, payload: TeamMemberAdd, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    team_res = await db.execute(select(Team).where(Team.id == team_id, Team.organization_id == org.id))
    if not team_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Team not found.")
    user_res = await db.execute(select(User).where(User.username == payload.username))
    target = user_res.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail=f"User '{payload.username}' not found.")
    existing = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == target.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already a team member.")
    db.add(TeamMember(team_id=team_id, user_id=target.id, role=payload.role))
    await db.commit()
    return {"user_id": str(target.id), "username": target.username, "role": payload.role.value}


@router.delete("/{org_name}/teams/{team_id}/members/{user_id}", status_code=204)
async def remove_team_member(org_name: str, team_id: uuid.UUID, user_id: uuid.UUID, current_user: Annotated[User, Depends(get_current_verified_user)], db: AsyncSession = Depends(get_db)):
    org = await _get_org_or_404(org_name, db)
    await _require_org_owner(org, current_user, db)
    result = await db.execute(select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found.")
    await db.delete(member)
    await db.commit()
