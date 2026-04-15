Tier 3, or Component tokens are [[Design Tokens]] that target specific UI components or special use cases. Component tokens assign [[Semantic Tokens]] or [[Primitive Tokens]] as their value.

**Examples:**
- JSON: `button.primary.color.background.hover`
- Figma: `button/primary/color/background/hover`
- CSS `--quieto-component-button-primary-color-background-hover`

## Component Token Anatomy

![[Component Tokens Anatomy.png]]

Using the example `--quieto-component-button-primary-color-background-hover` we will dissect the anatomy of a component token.

#### Global prefix
The global prefix is a developer only identifier and helps to let people know that this token originates from this particular design token system. It also helps prevent collisions with other tokens that aren’t part of this particular token system.

#### Tier identifier
This is another developer only identifier and helps differentiate alias and component tokens from the primitive tokens. It also signifies to developers that these are the tokens that should be associated with the design system’s component library.

#### Component name
The component name identifier signifies the name of the UI element that is being defined. If the component name is two or more words, then separate the name using dashes (ex: text-field).

#### Variant
The variant signifier defines the values to be applied to specific variants of a component.

- default (optional) is used exclusively to describe the common component application (e.g. button-default). This can either be explicitly defined or omitted if no variant infers default and that system is used across all tokens.
- Other values are dependent on the specific component API design (e.g. link-inverted, button-primary , etc).

#### Property
The property signifier describes the component property to be controlled:
- Can include token category (e.g. **color** or **border** ) if relevant.
- **color-content**: used exclusively for text  and icon colors.
- **color-background**: used exclusively for background color.
- **color-border**: used exclusively for border and outline colors.
- Any design/CSS property (e.g. **box-shadow**, **width**, **height**, **padding**, etc) can be defined as a component-specific token.

#### State
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