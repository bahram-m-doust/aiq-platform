import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/documents/storage", () => ({
  removePrivateFile: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import {
  processPendingStorageCleanups,
  removePrivateFileOrQueue,
} from "@/features/documents/storage-cleanup";
import { removePrivateFile } from "@/features/documents/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const mockedRemovePrivateFile = vi.mocked(removePrivateFile);
const mockedCreateAdminClient = vi.mocked(createAdminClient);

describe("storage cleanup outbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queues a failed storage rollback", async () => {
    mockedRemovePrivateFile.mockRejectedValueOnce(new Error("storage down"));
    const rpc = vi.fn(() => Promise.resolve({ data: "job-1", error: null }));
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const removed = await removePrivateFileOrQueue({
      storagePath: "brand/file/document.pdf",
      fileId: "file-1",
      reason: "UPLOAD_ROLLBACK",
    });

    expect(removed).toBe(false);
    expect(rpc).toHaveBeenCalledWith("enqueue_storage_cleanup", {
      p_storage_path: "brand/file/document.pdf",
      p_source_file_id: "file-1",
      p_reason: "UPLOAD_ROLLBACK",
    });
    consoleError.mockRestore();
  });

  it("removes queued objects and deletes completed jobs", async () => {
    mockedRemovePrivateFile.mockResolvedValueOnce(undefined);
    const deleteBuilder = {
      delete: vi.fn(() => deleteBuilder),
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    };
    const queryBuilder = {
      select: vi.fn(() => queryBuilder),
      order: vi.fn(() => queryBuilder),
      limit: vi.fn(() => queryBuilder),
      eq: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              id: "job-1",
              source_file_id: "file-1",
              storage_path: "brand/file/document.pdf",
            },
          ],
          error: null,
        }),
      ),
    };
    const from = vi
      .fn()
      .mockReturnValueOnce(queryBuilder)
      .mockReturnValueOnce(deleteBuilder);
    mockedCreateAdminClient.mockReturnValue({ from } as never);

    await processPendingStorageCleanups("file-1");

    expect(mockedRemovePrivateFile).toHaveBeenCalledWith(
      "brand/file/document.pdf",
    );
    expect(deleteBuilder.eq).toHaveBeenCalledWith("id", "job-1");
  });
});
