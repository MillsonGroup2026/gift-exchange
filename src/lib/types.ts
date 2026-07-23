export type Priority = 1 | 2 | 3;

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: "Would love it",
  2: "Would like it",
  3: "Nice extra",
};

export const OCCASIONS = ["Christmas", "Birthday", "Just because", "Wedding", "Baby", "Graduation"];

export type ListStatus = "draft" | "shared";
export type ClaimStatus = "planning" | "purchased";

export type RichText = { html: string; text: string } | null;

export interface LinkMeta {
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  siteName?: string;
}

export interface WishList {
  id: string;
  owner_id: string;
  title: string;
  occasion: string | null;
  status: ListStatus;
  public_share_token: string | null;
  ai_summary: unknown | null;
  ai_summary_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  title: string;
  description: RichText;
  url: string | null;
  link_meta: LinkMeta | null;
  priority: Priority;
  quantity: number;
  position: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Claim {
  id: string;
  item_id: string;
  claimer_id: string;
  quantity: number;
  status: ClaimStatus;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  list_id: string;
  item_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
}

export interface ListShare {
  id: string;
  list_id: string;
  shared_with_user_id: string | null;
  shared_with_email: string | null;
  shared_with_group_id: string | null;
  source: "invite" | "link";
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  owner_id: string;
  is_public: boolean;
  join_token: string | null;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  invited_email: string | null;
  role: "owner" | "member";
  status: "invited" | "active";
  created_at: string;
}

export interface SantaExchange {
  id: string;
  group_id: string;
  organizer_id: string;
  name: string;
  status: "draft" | "assigned";
  created_at: string;
  assigned_at: string | null;
}

export interface SantaParticipant {
  id: string;
  exchange_id: string;
  user_id: string;
  team: string | null;
  created_at: string;
}

export interface SantaRule {
  id: string;
  exchange_id: string;
  from_team: string;
  to_team: string;
}

export interface SantaExclusion {
  id: string;
  exchange_id: string;
  giver_user_id: string;
  recipient_user_id: string;
}

export interface SantaAssignment {
  id: string;
  exchange_id: string;
  giver_user_id: string;
  recipient_user_id: string;
  created_at: string;
}
