# Design Tokens
Design tokens are the platform-agnostic, named storage for visual design decisions (colors, spacing, typography) that represent data as key-value pairs (e.g., `color.primary = #007bff`). They act as a central, single source of truth, replacing hardcoded values to ensure consistency across multiple platforms, brands, or themes.

This document details the naming structure and algorithm for the design token system. The architecture follows a three-tiered token system.

## Design Token Tiers
There are three tiers of design tokens:
1. [[Primitive Tokens]]
2. [[Semantic Tokens]]
3. [[Component Tokens]]

#### Synonyms and related terms
-  **Variables / CSS Variables:** Often used to represent the value in code.
- **Theme Variables:** Synonymous with theming.
- **Primitive/Global Tokens:** The foundation values (e.g., `color.blue.500`).
- **Semantic/Alias Tokens:** Tokens with context (e.g., `color.text.primary`).
