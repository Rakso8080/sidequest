export interface User {
  id: number;
  email: string;
  username: string;
  display_name: string;
  avatar: string;
  bio: string;
  squad_id: number | null;
  total_points: number;
  streak: number;
  created_at: string;
}

export interface TokenResponse {
  token: string;
  user: User;
}

export interface SquadSettings {
  voting_rule: "majority" | "unanimous" | "quorum";
  quorum_pct: number;
  voting_hours: number;
  anonymous_votes: boolean;
  punishment_due_days: number;
  categories: string[];
  punishments: string[];
}

export interface Member {
  id: number;
  display_name: string;
  username: string;
  avatar: string;
  bio: string;
  total_points: number;
  streak: number;
  is_admin: boolean;
}

export interface Squad {
  id: number;
  name: string;
  invite_code: string;
  admin_id: number;
  settings: SquadSettings;
  members: Member[];
}

export interface Quest {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  proof_type: "photo" | "video" | "text" | "self_report";
  time_limit_hours: number;
  is_active: boolean;
  scheduled_for: string | null;
  created_by: number | null;
  created_by_name: string | null;
  my_status: string | null;
}

export interface QuestProposal {
  id: number;
  title: string;
  description: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  proof_type: "photo" | "video" | "text" | "self_report";
  time_limit_hours: number;
  status: "pending" | "approved" | "rejected";
  user_id: number;
  user_name: string;
  user_avatar: string;
  created_at: string;
  is_mine: boolean;
}

export interface VoteInfo {
  id: number;
  voter_id: number;
  decision: string;
  created_at: string;
}

export interface Submission {
  id: number;
  quest_id: number;
  quest_title: string;
  quest_points: number;
  quest_category: string;
  quest_proof_type: string;
  user_id: number;
  user_name: string;
  user_avatar: string;
  status: "in_progress" | "pending" | "approved" | "rejected" | "expired";
  proof_text: string;
  proof_file: string | null;
  started_at: string;
  submitted_at: string | null;
  deadline: string;
  resolved_at: string | null;
  votes: VoteInfo[];
  approve_count: number;
  reject_count: number;
  my_vote: string | null;
  i_can_vote: boolean;
  can_submit: boolean;
}

export interface Punishment {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar: string;
  description: string;
  status: "assigned" | "completed" | "overdue";
  due_date: string;
  created_at: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar: string;
  text: string;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  display_name: string;
  avatar: string;
  total_points: number;
  streak: number;
  quests_completed: number;
  is_admin: boolean;
}

export interface Badge {
  key: string;
  label: string;
  icon: string;
}

export interface Stats {
  total_points: number;
  streak: number;
  quests_completed: number;
  quests_pending: number;
  quests_rejected: number;
  completion_rate: number;
  favorite_category: string | null;
  rank: number;
  badges: Badge[];
}

export interface Dashboard {
  user: User;
  stats: Stats;
  active_quests: Submission[];
  pending_votes: Submission[];
  leaderboard: LeaderboardEntry[];
  my_punishments: Punishment[];
  unread_notifications: number;
}

export interface RecapItem {
  id: number;
  title: string;
  category: string;
  points: number;
  proof_file: string;
  created_at: string | null;
  user_name: string;
  user_avatar: string;
}

export interface Recap {
  squad_name: string;
  year: number | null;
  count: number;
  items: RecapItem[];
}
