/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, mock } from "bun:test";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockUserRepo = {
  getById: mock((_id: any) => Promise.resolve(null as any)),
  getByExternalId: mock((_id: any) => Promise.resolve(null as any)),
  getUserAdminDetail: mock((_id: any) => Promise.resolve(null as any)),
  listUsersAdmin: mock((_f: any) => Promise.resolve({ data: [], total: 0 } as any)),
  getAdminStats: mock(() => Promise.resolve({} as any)),
  updateAppUser: mock((_id: any, _d: any) => Promise.resolve({} as any)),
  countByRole: mock((_r: any) => Promise.resolve(2)),
  revokeSessions: mock((_e: any) => Promise.resolve()),
  deleteUserPermanently: mock((_id: any, _e: any) => Promise.resolve()),
  archiveUser: mock((_id: any, _e: any, _a: any, _d: any, _s: any) => Promise.resolve()),
  countArchived: mock(() => Promise.resolve(0)),
  restoreArchivedUser: mock((_a: any, _s: any, _e: any, _d: any, _n: any) => Promise.resolve()),
  getDeletionBlockers: mock((_id: any) => Promise.resolve([] as any[])),
  isEmailTaken: mock((_e: any, _x: any) => Promise.resolve(false)),
  updateExternalUserEmail: mock((_e: any, _m: any) => Promise.resolve()),
};
mock.module("../../repository/user.repository", () => ({ userRepository: mockUserRepo }));

const mockInvitationRepo = {
  hasUserUsedCode: mock((_id: any) => Promise.resolve(true)),
};
mock.module("../../repository/invitation.repository", () => ({
  invitationRepository: mockInvitationRepo,
}));

const mockOrganizationService = {
  addMemberDirect: mock((_o: any, _u: any) => Promise.resolve()),
  removeMember: mock((_o: any, _u: any) => Promise.resolve()),
};
mock.module("../organization.service", () => ({ organizationService: mockOrganizationService }));

const mockRequestPasswordReset = mock((_o: any) => Promise.resolve({}));
mock.module("../../config/auth", () => ({
  auth: { api: { requestPasswordReset: mockRequestPasswordReset } },
}));

import { UserService } from "../user.service";
import { ErrorCode } from "../../types/errors";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ACTOR_ID = "actor-1";
const TARGET_ID = "target-1";

function makeAppUser(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    externalId: "ext-target-1",
    displayName: "Target",
    shortName: "TGT",
    role: "player",
    deactivatedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function makeDetail(overrides: Record<string, unknown> = {}) {
  return {
    ...makeAppUser(),
    email: "target@example.com",
    emailVerified: true,
    createdAt: new Date(),
    lastLoginAt: null,
    matchCount: 0,
    tournamentCount: 0,
    organizations: [],
    ...overrides,
  };
}

const service = new UserService();

beforeEach(() => {
  for (const fn of Object.values(mockUserRepo)) fn.mockClear();
  mockOrganizationService.addMemberDirect.mockClear();
  mockOrganizationService.removeMember.mockClear();
  mockRequestPasswordReset.mockClear();

  mockUserRepo.getById.mockImplementation(() => Promise.resolve(makeAppUser() as any));
  mockUserRepo.getUserAdminDetail.mockImplementation(() => Promise.resolve(makeDetail() as any));
  mockUserRepo.countByRole.mockImplementation(() => Promise.resolve(2));
  mockUserRepo.getDeletionBlockers.mockImplementation(() => Promise.resolve([]));
  mockUserRepo.isEmailTaken.mockImplementation(() => Promise.resolve(false));
  mockUserRepo.countArchived.mockImplementation(() => Promise.resolve(0));
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("UserService admin guards", () => {
  it("refuses to administer your own account", async () => {
    await expect(service.adminUpdateUser(ACTOR_ID, ACTOR_ID, { role: "player" })).rejects.toMatchObject({
      code: ErrorCode.CANNOT_MODIFY_SELF,
    });
    expect(mockUserRepo.updateAppUser).not.toHaveBeenCalled();
  });

  it("404s on an unknown target", async () => {
    mockUserRepo.getById.mockImplementation(() => Promise.resolve(null as any));

    await expect(
      service.adminUpdateUser(ACTOR_ID, TARGET_ID, { displayName: "Nope" }),
    ).rejects.toMatchObject({ code: ErrorCode.USER_NOT_FOUND });
  });

  it("refuses to demote the last super admin", async () => {
    mockUserRepo.getById.mockImplementation(() =>
      Promise.resolve(makeAppUser({ role: "super_admin" }) as any),
    );
    mockUserRepo.countByRole.mockImplementation(() => Promise.resolve(1));

    await expect(
      service.adminUpdateUser(ACTOR_ID, TARGET_ID, { role: "player" }),
    ).rejects.toMatchObject({ code: ErrorCode.LAST_SUPER_ADMIN });
  });

  it("demotes a super admin when another one remains", async () => {
    mockUserRepo.getById.mockImplementation(() =>
      Promise.resolve(makeAppUser({ role: "super_admin" }) as any),
    );
    mockUserRepo.countByRole.mockImplementation(() => Promise.resolve(3));

    await service.adminUpdateUser(ACTOR_ID, TARGET_ID, { role: "player" });

    expect(mockUserRepo.updateAppUser).toHaveBeenCalledWith(TARGET_ID, {
      displayName: undefined,
      shortName: undefined,
      role: "player",
    });
  });

  it("rejects an email already used by someone else", async () => {
    mockUserRepo.isEmailTaken.mockImplementation(() => Promise.resolve(true));

    await expect(
      service.adminUpdateUser(ACTOR_ID, TARGET_ID, { email: "taken@example.com" }),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_ALREADY_EXISTS });
    expect(mockUserRepo.updateExternalUserEmail).not.toHaveBeenCalled();
  });
});

describe("UserService deactivation", () => {
  it("stamps the deactivation and revokes the sessions", async () => {
    await service.deactivateUser(ACTOR_ID, TARGET_ID);

    const [id, data] = mockUserRepo.updateAppUser.mock.calls[0] as [string, any];
    expect(id).toBe(TARGET_ID);
    expect(data.deactivatedAt).toBeInstanceOf(Date);
    expect(data.deactivatedBy).toBe(ACTOR_ID);
    expect(mockUserRepo.revokeSessions).toHaveBeenCalledWith("ext-target-1");
  });

  it("refuses to deactivate the last super admin", async () => {
    mockUserRepo.getById.mockImplementation(() =>
      Promise.resolve(makeAppUser({ role: "super_admin" }) as any),
    );
    mockUserRepo.countByRole.mockImplementation(() => Promise.resolve(1));

    await expect(service.deactivateUser(ACTOR_ID, TARGET_ID)).rejects.toMatchObject({
      code: ErrorCode.LAST_SUPER_ADMIN,
    });
    expect(mockUserRepo.revokeSessions).not.toHaveBeenCalled();
  });

  it("clears the deactivation on reactivation", async () => {
    await service.reactivateUser(TARGET_ID);

    expect(mockUserRepo.updateAppUser).toHaveBeenCalledWith(TARGET_ID, {
      deactivatedAt: null,
      deactivatedBy: null,
    });
  });

  it("blocks the login of a deactivated account", async () => {
    mockUserRepo.getByExternalId.mockImplementation(() =>
      Promise.resolve(makeAppUser({ deactivatedAt: new Date() }) as any),
    );

    await expect(service.getOrCreateAppUser("ext-target-1", "Target")).rejects.toMatchObject({
      code: ErrorCode.USER_DEACTIVATED,
    });
  });
});

describe("UserService permanent deletion", () => {
  it("deletes the Better Auth row when nothing owns content", async () => {
    await service.deleteUserPermanently(ACTOR_ID, TARGET_ID);

    expect(mockUserRepo.deleteUserPermanently).toHaveBeenCalledWith(TARGET_ID, "ext-target-1");
  });

  it("reports the blocking resources instead of deleting", async () => {
    mockUserRepo.getDeletionBlockers.mockImplementation(() =>
      Promise.resolve([{ resource: "tournaments", count: 3 }]),
    );

    await expect(service.deleteUserPermanently(ACTOR_ID, TARGET_ID)).rejects.toMatchObject({
      code: ErrorCode.USER_HAS_OWNED_CONTENT,
      details: { blockers: [{ resource: "tournaments", count: 3 }] },
    });
    expect(mockUserRepo.deleteUserPermanently).not.toHaveBeenCalled();
  });
});

describe("UserService archiving", () => {
  it("refuses to purge a player who only ever played matches", async () => {
    // The regression that lost real data: only `created_by` tables were checked,
    // so a plain player passed the guard and the cascade wiped their history.
    mockUserRepo.getDeletionBlockers.mockImplementation(() =>
      Promise.resolve([{ resource: "matches", count: 1 }]),
    );

    await expect(service.deleteUserPermanently(ACTOR_ID, TARGET_ID)).rejects.toMatchObject({
      code: ErrorCode.USER_HAS_OWNED_CONTENT,
    });
    expect(mockUserRepo.deleteUserPermanently).not.toHaveBeenCalled();
  });

  it("destroys the identity and anonymises the profile", async () => {
    mockUserRepo.countArchived.mockImplementation(() => Promise.resolve(4));

    await service.archiveUser(ACTOR_ID, TARGET_ID);

    expect(mockUserRepo.archiveUser).toHaveBeenCalledWith(
      TARGET_ID,
      "ext-target-1",
      ACTOR_ID,
      "Archive 5",
      "ARCH5",
    );
  });

  it("archives regardless of the data attached to the user", async () => {
    mockUserRepo.getDeletionBlockers.mockImplementation(() =>
      Promise.resolve([{ resource: "matches", count: 12 }]),
    );

    await service.archiveUser(ACTOR_ID, TARGET_ID);

    expect(mockUserRepo.archiveUser).toHaveBeenCalledTimes(1);
  });

  it("refuses to archive twice", async () => {
    mockUserRepo.getById.mockImplementation(() =>
      Promise.resolve(makeAppUser({ archivedAt: new Date() }) as any),
    );

    await expect(service.archiveUser(ACTOR_ID, TARGET_ID)).rejects.toMatchObject({
      code: ErrorCode.USER_ALREADY_ARCHIVED,
    });
    expect(mockUserRepo.archiveUser).not.toHaveBeenCalled();
  });

  it("refuses to archive the last super admin", async () => {
    mockUserRepo.getById.mockImplementation(() =>
      Promise.resolve(makeAppUser({ role: "super_admin" }) as any),
    );
    mockUserRepo.countByRole.mockImplementation(() => Promise.resolve(1));

    await expect(service.archiveUser(ACTOR_ID, TARGET_ID)).rejects.toMatchObject({
      code: ErrorCode.LAST_SUPER_ADMIN,
    });
  });

  it("uses the label chosen by the admin over the generated one", async () => {
    mockUserRepo.countArchived.mockImplementation(() => Promise.resolve(0));

    await service.archiveUser(ACTOR_ID, TARGET_ID, {
      displayName: "Ancien membre 2022",
      shortName: "AM22",
    });

    expect(mockUserRepo.archiveUser).toHaveBeenCalledWith(
      TARGET_ID,
      "ext-target-1",
      ACTOR_ID,
      "Ancien membre 2022",
      "AM22",
    );
  });

  it("refuses to change the email of an archived user", async () => {
    mockUserRepo.getById.mockImplementation(() =>
      Promise.resolve(makeAppUser({ externalId: null, archivedAt: new Date() }) as any),
    );

    await expect(
      service.adminUpdateUser(ACTOR_ID, TARGET_ID, { email: "new@example.com" }),
    ).rejects.toMatchObject({ code: ErrorCode.USER_IS_ARCHIVED });
  });
});

describe("UserService restoring an archived player", () => {
  const ARCHIVED_ID = "archived-1";
  const SOURCE_ID = "source-1";

  function archived(overrides: Record<string, unknown> = {}) {
    return makeAppUser({ id: ARCHIVED_ID, externalId: null, archivedAt: new Date(), ...overrides });
  }
  function source(overrides: Record<string, unknown> = {}) {
    return makeAppUser({
      id: SOURCE_ID,
      externalId: "ext-source-1",
      displayName: "Bob Returns",
      shortName: "BOB",
      ...overrides,
    });
  }

  function route(map: Record<string, unknown>) {
    mockUserRepo.getById.mockImplementation((id: any) => Promise.resolve(map[id] ?? null));
  }

  it("moves the new identity onto the archived history", async () => {
    route({ [ARCHIVED_ID]: archived(), [SOURCE_ID]: source() });

    await service.restoreArchivedUser(ACTOR_ID, ARCHIVED_ID, { sourceUserId: SOURCE_ID });

    expect(mockUserRepo.restoreArchivedUser).toHaveBeenCalledWith(
      ARCHIVED_ID,
      SOURCE_ID,
      "ext-source-1",
      "Bob Returns",
      "BOB",
    );
  });

  it("refuses when the new account already has its own data", async () => {
    route({ [ARCHIVED_ID]: archived(), [SOURCE_ID]: source() });
    mockUserRepo.getDeletionBlockers.mockImplementation(() =>
      Promise.resolve([{ resource: "matches", count: 3 }]),
    );

    await expect(
      service.restoreArchivedUser(ACTOR_ID, ARCHIVED_ID, { sourceUserId: SOURCE_ID }),
    ).rejects.toMatchObject({
      code: ErrorCode.USER_HAS_OWNED_CONTENT,
      details: { blockers: [{ resource: "matches", count: 3 }] },
    });
    expect(mockUserRepo.restoreArchivedUser).not.toHaveBeenCalled();
  });

  it("refuses when the target is not archived", async () => {
    route({ [ARCHIVED_ID]: archived({ archivedAt: null }), [SOURCE_ID]: source() });

    await expect(
      service.restoreArchivedUser(ACTOR_ID, ARCHIVED_ID, { sourceUserId: SOURCE_ID }),
    ).rejects.toMatchObject({ code: ErrorCode.USER_NOT_ARCHIVED });
  });

  it("refuses when the source is itself archived", async () => {
    route({ [ARCHIVED_ID]: archived(), [SOURCE_ID]: source({ archivedAt: new Date() }) });

    await expect(
      service.restoreArchivedUser(ACTOR_ID, ARCHIVED_ID, { sourceUserId: SOURCE_ID }),
    ).rejects.toMatchObject({ code: ErrorCode.USER_ALREADY_ARCHIVED });
  });

  it("refuses when the admin picks their own account as the source", async () => {
    route({ [ARCHIVED_ID]: archived(), [ACTOR_ID]: source({ id: ACTOR_ID }) });

    await expect(
      service.restoreArchivedUser(ACTOR_ID, ARCHIVED_ID, { sourceUserId: ACTOR_ID }),
    ).rejects.toMatchObject({ code: ErrorCode.CANNOT_MODIFY_SELF });
  });
});

describe("UserService password reset", () => {
  it("asks Better Auth to mail a reset link", async () => {
    await service.sendPasswordReset(TARGET_ID);

    expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1);
    const [{ body }] = mockRequestPasswordReset.mock.calls[0] as [
      { body: { email: string; redirectTo: string } },
    ];
    expect(body.email).toBe("target@example.com");
    // Must be absolute: a relative path resolves against the backend origin,
    // which serves no /reset-password route outside production.
    expect(body.redirectTo).toMatch(/^https?:\/\/.+\/reset-password$/);
  });

  it("honours FRONTEND_URL for the reset link", async () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = "https://skol.example.com";
    try {
      await service.sendPasswordReset(TARGET_ID);
      const [{ body }] = mockRequestPasswordReset.mock.calls[0] as [
        { body: { redirectTo: string } },
      ];
      expect(body.redirectTo).toBe("https://skol.example.com/reset-password");
    } finally {
      if (previous === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = previous;
    }
  });

  it("404s when the target has no email", async () => {
    mockUserRepo.getUserAdminDetail.mockImplementation(() =>
      Promise.resolve(makeDetail({ email: null }) as any),
    );

    await expect(service.sendPasswordReset(TARGET_ID)).rejects.toMatchObject({
      code: ErrorCode.USER_NOT_FOUND,
    });
  });
});
