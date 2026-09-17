/* eslint-disable @typescript-eslint/unbound-method */
import { EntityManager, LockMode } from "@mikro-orm/core";
import { NotFoundException } from "@nestjs/common";
import type { Mocked } from "vitest";

import { User } from "../entities/user.entity.js";
import { UserDeletionService } from "./user-deletion.service.js";

describe("UserDeletionService", () => {
  it.each([false, true])(
    "deletes only the user in the appropriate transaction context (scoped: %s)",
    async (scoped) => {
      const { em, service } = createService(scoped);
      const user = Object.assign(new User(), { id: "user-1" });
      const beforeDelete = vi.fn();
      em.findOne.mockResolvedValue(user);

      await expect(service.deleteUser(user.id, beforeDelete)).resolves.toBe(
        user,
      );

      expect(em.findOne).toHaveBeenCalledExactlyOnceWith(
        User,
        { id: user.id },
        scoped
          ? { refresh: true }
          : { filters: false, lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      expect(em.transactional).toHaveBeenCalledExactlyOnceWith(
        expect.any(Function),
        scoped ? { clear: true } : {},
      );
      expect(beforeDelete).toHaveBeenCalledOnce();
      expect(em.nativeDelete).toHaveBeenCalledExactlyOnceWith(User, {
        id: user.id,
      });
      expect(beforeDelete.mock.invocationCallOrder[0]).toBeLessThan(
        em.nativeDelete.mock.invocationCallOrder[0],
      );
    },
  );

  it("returns null without invoking hooks or deleting a missing user", async () => {
    const { em, service } = createService();
    const beforeDelete = vi.fn();
    em.findOne.mockResolvedValue(null);
    await expect(
      service.deleteUser("missing", beforeDelete),
    ).resolves.toBeNull();
    expect(beforeDelete).not.toHaveBeenCalled();
    expect(em.nativeDelete).not.toHaveBeenCalled();
  });

  it("does not delete the user when the before-delete hook fails", async () => {
    const { em, service } = createService();
    em.findOne.mockResolvedValue(new User());
    const error = new Error("Deletion canceled");
    await expect(
      service.deleteUser("user-1", vi.fn().mockRejectedValue(error)),
    ).rejects.toBe(error);
    expect(em.nativeDelete).not.toHaveBeenCalled();
  });

  it("rejects a deletion that no longer affects a visible user", async () => {
    const { em, service } = createService();
    em.findOne.mockResolvedValue(new User());
    em.nativeDelete.mockResolvedValue(0);
    await expect(service.deleteUser("user-1")).rejects.toThrow(
      NotFoundException,
    );
  });
});

function createService(scoped = false) {
  const em = {
    getContext: vi.fn().mockReturnThis(),
    getSessionContext: vi.fn(() =>
      scoped
        ? {
            role: "authenticated",
            variables: { "app.user.id": "administrator" },
          }
        : undefined,
    ),
    findOne: vi.fn(),
    nativeDelete: vi.fn().mockResolvedValue(1),
    transactional: vi.fn(),
  } as unknown as Mocked<EntityManager>;
  em.transactional.mockImplementation(async (callback) => await callback(em));
  return { em, service: new UserDeletionService(em) };
}
