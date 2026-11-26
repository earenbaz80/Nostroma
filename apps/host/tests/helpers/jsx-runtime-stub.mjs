/** The automatic JSX runtime, as plain objects: a test calls a component and reads its tree, nothing renders. */
export const Fragment = Symbol.for('react.fragment');
export const jsx = (type, props, key) => ({ type, props: props ?? {}, key });
export const jsxs = jsx;
