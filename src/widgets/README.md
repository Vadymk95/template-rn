# widgets

Widget compositions live here (`<widget-name>/` per widget). A widget wires one or more features into a screen-level or large-section composition; it is the largest unit below a route.

## Why this README exists

Right after `docs/template-reset.md` strips the Todo example, `todo-workspace/` — the only widget shipped with the template — goes with it, and this directory becomes **empty**.

This file is the **FSD anchor** that keeps the boundary visible to agents and git between the reset and the first product widget. **Do not delete** until the forked repo has at least one real widget tracked — at that point the anchor is redundant and can be removed in the same commit that lands the first widget.

See `.cursor/brain/MAP.md` for the full layer contract.
