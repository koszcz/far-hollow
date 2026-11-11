// The shape of a backpack icon drawing, shared by backpack-icons.tsx and crafting-icons.tsx. BackpackIcon draws them.

/**
 * One part of an icon. `fill` is a filled shape and `line` is a thick stroke. A part takes the icon's main colour,
 * or its own `colour` when it has one, so tools can show a wooden handle and a steel blade.
 * `cut` and `cutLine` draw in the chip's background colour, to carve detail out of a filled shape.
 * `shine` is a thin pale glint, such as the light on a steel edge. It gets no outline.
 */
export interface IconPart {
  d: string;
  as: "fill" | "line" | "cut" | "cutLine" | "shine";
  colour?: string;
}

export interface BackpackIconDrawing {
  colour: string;
  parts: readonly IconPart[];
}
