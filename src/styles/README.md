# SCSS architecture

- `abstracts/`: Sass variables, mixins and functions. No emitted page styles.
- `base/`: reset, typography and global element rules.
- `components/`: reusable UI components such as buttons and form controls.
- `layouts/`: shared page layout primitives.
- `pages/`: page-specific styles such as authentication and dashboard.
- `main.scss`: single Sass entry point imported by `src/main.jsx`.

Use `@use` rather than deprecated Sass `@import`. Keep component styles close to reusable components when the application grows.
