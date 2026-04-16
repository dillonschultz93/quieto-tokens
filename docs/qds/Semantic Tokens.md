# Semantic Tokens
Tier 2, or Semantic tokens, are [[Design Tokens]] that take the Primitive tokens and applies them to high-level applications within the UI. Essentially, [[Primitive Tokens]] are assigned as the value of Semantic tokens.

**Examples:**
- JSON: `color.background.default.hover`
- Figma: `color/background/default/hover`
- CSS: `--quieto-semantic-color-background-default-hover`

## Semantic Token Anatomy

![[Semantic Tokens Anatomy.png]]

Using the example `--quieto-semantic-color-background-default-hover` we will dissect the anatomy of a semantic token.

#### Global prefix
The global prefix is a developer only identifier and helps to let people know that this token originates from this particular design token system. It also helps prevent collisions with other tokens that aren’t part of this particular token system.

#### Tier identifier
This is another developer only identifier and helps differentiate alias and component tokens from the primitive tokens. It also signifies to developers that these are the tokens that should be associated with the design system’s component library.

#### Category
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

#### Property
The property identifier signifies what the category is being applied to. So, for the example above, color is being applied to the background property of a surface within the interface.  
  
The available surfaces are:
- **content**: used exclusively for text  and icon colors.
- **background**: used exclusively for background color.
- **border**: used exclusively for border and outline colors.

#### Role
The role identifier signifies which kind of interface element we are applying the category and property to. So, for example above, a background color is being applied to a default surface of the interface.

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