import { Button as HeroUIButton } from "@heroui/react";
import type { ComponentProps } from "react";

type HeroBtn = ComponentProps<typeof HeroUIButton>;

/** Atributos DOM que react-aria `Button` reenvía y a menudo faltan en los tipos exportados de `@heroui/react` beta. */
type DomExtra = Pick<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "title" | "role" | "aria-selected" | "aria-pressed" | "onMouseEnter" | "onMouseLeave" | "onPointerDown"
>;

export type DomButtonProps = HeroBtn & DomExtra;

/** Misma API que `Button` de HeroUI; permite `title`, `role`, hover handlers, etc. */
export function DomButton(props: DomButtonProps) {
  return <HeroUIButton {...(props as HeroBtn)} />;
}
