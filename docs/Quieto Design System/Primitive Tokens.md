Tier 1, or Primitive tokens, are [[Design Tokens]] that define the design system’s core attributes serving as an obfuscation to raw values.

**Examples:**
- JSON: `color.blue.400`
- Figma: `color/blue/400`
- CSS: `--ds-color-blue-400`

## Primitive Token Anatomy

![[Primitive Tokens Anatomy.png]]

Using the example `--quieto-color-blue-400` we will dissect the anatomy of a primitive token.

#### Global prefix
The global prefix is a developer only identifier and helps to let people know that this token originates from this particular design token system. It also helps prevent collisions with other tokens that aren’t part of this particular token system. So, in the example above `--quieto-...` is the global prefix.

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

#### Sub-category
The sub-category identifier signifies any deeper design choices that need to be conveyed. In this example, the hue of the color category.

#### Value
The value identifier serves as a way to identify a determined raw value. Using a ramp numbering system or t-shirt sizing is a common way to convey this.