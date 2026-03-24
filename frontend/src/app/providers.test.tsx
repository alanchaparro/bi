import React, { memo } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./providers";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@heroui/react", () => ({
  RouterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const restoreSessionMock = vi.fn();
const setOnUnauthorizedMock = vi.fn();
const setAuthTokenMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("@/shared/api", () => ({
  restoreSession: (...args: unknown[]) => restoreSessionMock(...args),
  setOnUnauthorized: (...args: unknown[]) => setOnUnauthorizedMock(...args),
  setAuthToken: (...args: unknown[]) => setAuthTokenMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
}));

describe("AuthProvider context stability", () => {
  beforeEach(() => {
    restoreSessionMock.mockReset();
    setOnUnauthorizedMock.mockReset();
    setAuthTokenMock.mockReset();
    logoutMock.mockReset();
  });

  it("keeps stable context value across parent rerenders", () => {
    restoreSessionMock.mockImplementation(() => new Promise(() => {}));

    const contextRefs: Array<ReturnType<typeof useAuth>> = [];
    const renders = { current: 0 };

    const Consumer = memo(function Consumer() {
      const ctx = useAuth();
      renders.current += 1;
      contextRefs.push(ctx);
      return <div data-testid="ctx-loading">{String(ctx.loading)}</div>;
    });

    const tree = (
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    const { rerender } = render(tree);
    rerender(tree);
    rerender(tree);

    expect(renders.current).toBe(1);
    expect(contextRefs.length).toBe(1);
    expect(contextRefs[0]).toBeTruthy();
  });
});
