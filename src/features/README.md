# features

Feature slices live here (`<feature-name>/` per slice). Each slice owns its local hooks, components, and feature-specific copy; cross-feature work goes through `src/entities/` or `src/shared/**`, not sibling imports.

## Why this README exists

Right after `docs/template-reset.md` strips the Todo example slice, this directory becomes **empty** — a new product slice lands in its place.

This file is the **FSD anchor** that keeps the boundary visible to agents and git between the reset and the first product slice. **Do not delete** until the forked repo has at least one real feature slice tracked — at that point the anchor is redundant and can be removed in the same commit that lands the first slice.

See `.cursor/brain/MAP.md` for the full layer contract.
