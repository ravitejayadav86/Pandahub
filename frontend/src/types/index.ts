export interface User {
  id: number;
  username: string;
  email?: string;
  full_name?: string;
  bio?: string;
  avatar_url?: string;
  website?: string;
  location?: string;
  company?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface Repository {
  id: number;
  name: string;
  slug: string;
  description?: string;
  visibility: 'public' | 'private' | 'internal';
  default_branch: string;
  star_count: number;
  fork_count: number;
  open_issues_count: number;
  is_fork: boolean;
  owner_id?: number;
  org_id?: number;
  owner_username?: string;
  created_at: string;
  updated_at: string;
  pushed_at?: string;
}

export interface Issue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  repository_id: number;
  author_id: number;
  assignee_id?: number;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  comment_count: number;
}

export interface IssueComment {
  id: number;
  issue_id: number;
  author_id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface TreeEntry {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  sha: string;
}

export interface Commit {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
}

export interface Branch {
  name: string;
  sha: string;
}

export interface BlobContent {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
  size: number;
  sha: string;
}

export interface Token {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ApiError {
  detail: string;
}
