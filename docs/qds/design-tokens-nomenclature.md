# Design Tokens
Design tokens are the platform-agnostic, named storage for visual design decisions (colors, spacing, typography) that represent data as key-value pairs (e.g., `color.primary = #007bff`). They act as a central, single source of truth, replacing hardcoded values to ensure consistency across multiple platforms, brands, or themes.

This document details the naming structure and algorithm for the design token system. The architecture follows a three-tiered token system.

## Design Token Tiers
There are three tiers of design tokens:
1. Primitive Tokens
2. Semantic Tokens
3. Component Tokens

### Primitive Tokens
Tier 1, or Primitive tokens, are Design Tokens that define the design system’s core attributes serving as an obfuscation to raw values.

**Examples:**
- JSON: `color.blue.400`
- Figma: `color/blue/400`
- CSS: `--ds-color-blue-400`

#### Primitive Token Anatomy

![[Primitive Tokens Anatomy.png]]

Using the example `--quieto-color-blue-400` we will dissect the anatomy of a primitive token.

##### Global prefix
The global prefix is a developer only identifier and helps to let people know that this token originates from this particular design token system. It also helps prevent collisions with other tokens that aren’t part of this particular token system. So, in the example above `--quieto-...` is the global prefix.

##### Category
The category identifier signifies the type of design choice that the token is conveying. In this example above color value is being defined.
  
The available category types are:  
- color  
- typography  
- spacing  
- border 
- shadow  
- animation

##### Sub-category (if needed)
The sub-category identifier signifies any deeper design choices that need to be conveyed. 

The available sub-category types are:
- color or hue name (i.e. "blue" or "green")
- font-size
- font-family
- font-weight
- font-style
- line-height
- text-transform
- letter-spacing
- radius
- width
- x
- y
- blur
- spread
- duration
- ease

##### Value
The value identifier serves as a way to identify a determined raw value. Using a ramp numbering system or t-shirt sizing is a common way to convey this.

### Semantic Tokens
Tier 2, or Semantic tokens, are Design Tokens that take the Primitive tokens and applies them to high-level applications within the UI. Essentially, Primitive Tokens are assigned as the value of Semantic tokens.

**Examples:**
- JSON: `color.background.default.hover`
- Figma: `color/background/default/hover`
- CSS: `--ds-semantic-color-background-default-hover`

#### Semantic Token Anatomy

![[Semantic Tokens Anatomy.png]]

Using the example `--quieto-semantic-color-background-default-hover` we will dissect the anatomy of a semantic token.

##### Global prefix
The global prefix is a developer only identifier and helps to let people know that this token originates from this particular design token system. It also helps prevent collisions with other tokens that aren’t part of this particular token system.

##### Tier identifier
This is another developer only identifier and helps differentiate alias and component tokens from the primitive tokens. It also signifies to developers that these are the tokens that should be associated with the design system’s component library.

##### Category
The category identifier signifies the type of design choice that the token is conveying. In this example above color value is being defined.  
  
The available category types are:
- color  
- typography  
- spacing  
- border  
- width  
- radius  
- elevation  
- animation

##### Property
The property identifier signifies what the category is being applied to. So, for the example above, color is being applied to the background property of a surface within the interface.  
  
The available surfaces are:
- **content**: used exclusively for text  and icon colors.
- **background**: used exclusively for background color.
- **border**: used exclusively for border and outline colors.

##### Role
The role identifier signifies which kind of interface element we are applying the category and property to. So, for the example above, a background color is being applied to a default surface of the interface.

The available roles are:
- default  
- primary  
- secondary  
- info  
- warning  
- danger  
- success  
- subtle  
- neutral
- headline
- display
- title
- body
- label
- meta
- data

##### State
The state identifier signifies how the token definition is going to be used. So, in this final example above, a background color is being applied to a default surface when that piece of interface is hovered.  
  
The available states are:
- hover
- active
- focus
- disabled
- visited
- selected
- checked
- unchecked

### Component Tokens
Tier 3, or Component tokens are Design Tokens that target specific UI components or special use cases. Component tokens assign Semantic Tokens or Primitive Tokens as their value.

**Examples:**
- JSON: `button.primary.color.background.hover`
- Figma: `button/primary/color/background/hover`
- CSS `--ds-component-button-primary-color-background-hover`

#### Component Token Anatomy

![[Component Tokens Anatomy.png]]

Using the example `--quieto-component-button-primary-color-background-hover` we will dissect the anatomy of a component token.

##### Global prefix
The global prefix is a developer only identifier and helps to let people know that this token originates from this particular design token system. It also helps prevent collisions with other tokens that aren’t part of this particular token system.

##### Tier identifier
This is another developer only identifier and helps differentiate alias and component tokens from the primitive tokens. It also signifies to developers that these are the tokens that should be associated with the design system’s component library.

##### Component name
The component name identifier signifies the name of the UI element that is being defined. If the component name is two or more words, then separate the name using dashes (ex: text-field).

##### Variant
The variant signifier defines the values to be applied to specific variants of a component.

- default (optional) is used exclusively to describe the common component application (e.g. button-default). This can either be explicitly defined or omitted if no variant infers default and that system is used across all tokens.
- Other values are dependent on the specific component API design (e.g. link-inverted, button-primary , etc).

##### Property
The property signifier describes the component property to be controlled:
- Can include token category (e.g. **color** or **border** ) if relevant.
- **color-content**: used exclusively for text  and icon colors.
- **color-background**: used exclusively for background color.
- **color-border**: used exclusively for border and outline colors.
- Any design/CSS property (e.g. **box-shadow**, **width**, **height**, **padding**, etc) can be defined as a component-specific token.

##### State
The state identifier signifies how the token definition is going to be used. So, in this final example above, a background color is being applied to a default surface when that piece of interface is hovered.  
  
The available states are:
- hover
- active
- focus
- disabled
- visited
- selected
- checked
- unchecked