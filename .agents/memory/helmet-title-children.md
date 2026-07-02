---
name: react-helmet-async title children
description: react-helmet-async v3 requires <title> children to be a single string — mixing JSX text nodes with {number} or {variable} creates an array that crashes Helmet silently (blank white page, "An error occurred in the <Helmet> component").
---

## Rule
In react-helmet-async v3, the `<title>` element must receive a single string child. Mixed JSX nodes crash it.

**Wrong** (crashes):
```jsx
<title>Article about {total} products | ABCDE.lv</title>
```

**Correct** (use template literal):
```jsx
<title>{`Article about ${total} products | ABCDE.lv`}</title>
```

## Why
react-helmet-async v3 changed how it processes title children. When JSX renders `"text" + {number} + "text"` as siblings, React produces a child array `["text", 3, "text"]` instead of a single string. Helmet v3 fails to stringify this array and throws, causing React to unmount the entire tree (blank page).

## How to apply
Any time you add a `<Helmet>` with a dynamic title — especially with numbers, counts, or computed values — wrap the whole title in a template literal: `{`...${variable}...`}`. This applies to all pages in this codebase (react-helmet-async v3.0.0).

The `<meta name="description" content={`...`} />` form is already safe since `content` is a prop (string), not children.
