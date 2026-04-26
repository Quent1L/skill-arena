export interface Organization {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
}

export interface OrganizationWithMemberCount extends Organization {
  memberCount: number;
}

export interface OrganizationMemberWithUser {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  user: { id: string; displayName: string; shortName: string; role: string };
}
