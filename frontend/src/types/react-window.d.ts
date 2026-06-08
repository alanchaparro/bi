declare module "react-window" {
  import * as React from "react";
  export interface ListChildComponentProps {
    index: number;
    style: React.CSSProperties;
    data?: any;
    isScrolling?: boolean;
  }
  export interface FixedSizeListProps {
    children: React.FC<ListChildComponentProps> | React.ComponentClass<ListChildComponentProps>;
    className?: string;
    height: number;
    itemCount: number;
    itemData?: any;
    itemSize: number;
    width: string | number;
    style?: React.CSSProperties;
    overscanCount?: number;
    useIsScrolling?: boolean;
    layout?: "horizontal" | "vertical";
    onItemsRendered?: any;
    onScroll?: any;
    initialScrollOffset?: number;
    initialScrollIndex?: number;
    direction?: "ltr" | "rtl";
  }
  export interface VariableSizeListProps extends FixedSizeListProps {
    itemSize: (index: number) => number;
  }
  export class FixedSizeList extends React.Component<FixedSizeListProps> {}
  export class VariableSizeList extends React.Component<VariableSizeListProps> {}
}
