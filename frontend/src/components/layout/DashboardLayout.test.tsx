import React, { memo } from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLayout, useSyncLive } from "./DashboardLayout";

const replaceMock = vi.fn();
const logoutMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/config",
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@heroui/react", () => ({
  Button: ({
    children,
    onPress,
    isIconOnly,
    ...props
  }: React.PropsWithChildren<Record<string, unknown> & { onPress?: () => void; isIconOnly?: boolean }>) => (
    <button type="button" onClick={onPress} data-icon-only={isIconOnly ? "true" : undefined} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/app/providers", () => ({
  useAuth: () => ({ auth: { role: "admin" }, loading: false, logout: logoutMock }),
}));

vi.mock("@/config/routes", () => ({
  NAV_ITEMS: [],
}));

describe("DashboardLayout SyncLiveContext stability", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    logoutMock.mockReset();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        media: "(min-width: 1024px)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("keeps stable context value across parent rerenders", () => {
    const contextRefs: Array<ReturnType<typeof useSyncLive>> = [];
    const renders = { current: 0 };

    const Consumer = memo(function Consumer() {
      const ctx = useSyncLive();
      renders.current += 1;
      contextRefs.push(ctx);
      return <div data-testid="sync-live-running">{String(Boolean(ctx.syncLive?.running))}</div>;
    });

    const tree = (
      <DashboardLayout>
        <Consumer />
      </DashboardLayout>
    );

    const { rerender } = render(tree);
    rerender(tree);
    rerender(tree);

    expect(renders.current).toBe(1);
    expect(contextRefs).toHaveLength(1);
    expect(contextRefs[0].setSyncLive).toBeTypeOf("function");
    expect(contextRefs[0].setScheduleLive).toBeTypeOf("function");
  });
});
